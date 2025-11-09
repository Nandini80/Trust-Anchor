const User = require("../../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { gmail } = require("googleapis/build/src/apis/gmail");
const transporter = require("../../config/nodemailer");
const generateRandomString = require("../../utils/random");
const Bank = require("../../models/Bank");
const { getDetails, getReqList, handelRequest, registerCustomer, updateRecordBC} = require("./blockchain");

module.exports.register = async (req, res) => {
  try {
    console.log("Register request received. Body keys:", Object.keys(req.body));
    console.log("Files received:", req.files ? Object.keys(req.files) : 'No files');
    
    if (req.body.sender == "client") {
      // Parse formData - it comes as JSON string when files are uploaded
      let formData;
      try {
        formData = typeof req.body.formData === 'string' 
          ? JSON.parse(req.body.formData) 
          : req.body.formData;
      } catch (parseError) {
        console.error("Error parsing formData:", parseError);
        return res.status(400).json({
          message: "Invalid form data format",
          success: false,
          error: parseError.message
        });
      }
      
      // Validate required fields
      if (!formData.email) {
        return res.status(400).json({
          message: "Email is required",
          success: false,
        });
      }
      
      let user = await User.findOne({ email: formData.email });
      if (user) {
        return res.status(400).json({
          message: "User already exists",
          success: false,
        });
      }
      let kycId = "KYC-" + generateRandomString();
      let userWithKYC = await User.findOne({ kycId: kycId });
      while (userWithKYC) {
        kycId = "KYC-" + generateRandomString();
        userWithKYC = await User.findOne({ kycId: kycId });
      }
      let pass = generateRandomString(8);
      let hash = await bcrypt.hash(pass, 10);
      
      // Extract file paths from uploaded files
      // Files are uploaded as: panFile, aadharFile, selfieFile
      const panPath = req.files?.panFile ? `/documents/${req.files.panFile[0].filename}` : formData.panIPFS || '';
      const aadharPath = req.files?.aadharFile ? `/documents/${req.files.aadharFile[0].filename}` : formData.aadharIPFS || '';
      const selfiePath = req.files?.selfieFile ? `/documents/${req.files.selfieFile[0].filename}` : formData.selfieIPFS || '';
      
      // Update formData with file paths (using same field names for blockchain compatibility)
      formData.panIPFS = panPath;
      formData.aadharIPFS = aadharPath;
      formData.selfieIPFS = selfiePath;
      
      // Try to register on blockchain, but don't fail if blockchain is not available
      let receipt;
      try {
        console.log("Attempting blockchain registration...");
        receipt = await registerCustomer(formData, kycId);
        console.log("Blockchain receipt:", receipt);
      } catch (blockchainError) {
        // Log the error but continue with registration
        console.error("========================================");
        console.error("BLOCKCHAIN ERROR (Registration will continue):");
        console.error("Error message:", blockchainError.message);
        console.error("Error stack:", blockchainError.stack);
        console.error("========================================");
        // Continue with registration even if blockchain fails
        // This allows the system to work even if blockchain is not set up
        receipt = null; // Explicitly set to null to indicate failure
      }
      user = User({
        email: formData.email,
        kycId: kycId,
        password: hash,
      });
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET);
      await user.save();
      
      // Try to send email, but don't fail registration if email fails
      try {
        await transporter.sendMail({
          from: "eKYC Portal <ayushtest935@gmail.com>",
          to: user.email,
          replyTo: "ayushtest935@gmail.com",
          subject: "KYC credentials",
          html: `<h4><span style="font-size:16px">Email</span>:&nbsp; ${user.email}</h4>
                          <h4><span style="font-size:16px">Password</span>:&nbsp; ${pass}</h4>
                          <h4><span style="font-size:16px">KYC-ID</span>:&nbsp; ${user.kycId}</h4>`,
        });
        console.log("Registration email sent successfully to:", user.email);
      } catch (emailError) {
        console.error("========================================");
        console.error("EMAIL ERROR (Registration still successful):");
        console.error("Error message:", emailError.message);
        console.error("Error code:", emailError.code);
        console.error("========================================");
        // Continue with registration even if email fails
      }
      
      res.status(200).json({
        message: "Registered Successfully",
        data: {
          user,
          token: token,
        },
        success: true,
      });
    } else if (req.body.sender == "bank") {
      let bank = await Bank.findOne({ email: req.body.email });
      let bankEth = await Bank.findOne({ ethAddress: req.body.ethAddress });
      if (bank || bankEth) {
        return res.status(400).json({
          message: "Bank already exists",
          success: false,
        });
      }
      let pass = generateRandomString(8);
      let hash = await bcrypt.hash(pass, 10);
      bank = Bank({
        email: req.body.email,
        ethAddress: req.body.ethAddress,
        password: hash,
      });
      const token = jwt.sign({ email: bank.email }, process.env.JWT_SECRET);
      await bank.save();
      const result = await transporter.sendMail({
        from: "eKYC Portal <ayushtest935@gmail.com>",
        to: bank.email,
        replyTo: "ayushtest935@gmail.com",
        subject: "Bank credentials",
        html: `<p><span style="font-size:16px">Email</span>:&nbsp; ${bank.email}</p>
                        <p><span style="font-size:16px">Password</span>:&nbsp; ${pass}</p>`,
      });
      res.status(200).json({
        message: "Registered Successfully",
        data: {
          bank,
          token: token,
        },
        success: true,
      });
    } else {
      res.status(400).json({
        message: "Sender not specified!",
        success: false,
      });
    }
  } catch (err) {
    console.error("Register error:", err);
    console.error("Error stack:", err.stack);
    
    // If it's a blockchain-related error, still try to complete registration
    if (err.message && err.message.includes('address') && err.message.includes('undefined')) {
      console.error("Blockchain error detected in outer catch - this should have been caught earlier");
      // Try to continue with registration if we have the formData
      if (req.body && req.body.sender === "client") {
        try {
          let formData;
          try {
            formData = typeof req.body.formData === 'string' 
              ? JSON.parse(req.body.formData) 
              : req.body.formData;
          } catch (parseError) {
            // Can't parse, return error
            return res.status(500).json({
              error: err.message,
              message: "Something went wrong",
              success: false,
            });
          }
          
          // Continue with registration without blockchain
          let kycId = "KYC-" + generateRandomString();
          let userWithKYC = await User.findOne({ kycId: kycId });
          while (userWithKYC) {
            kycId = "KYC-" + generateRandomString();
            userWithKYC = await User.findOne({ kycId: kycId });
          }
          let pass = generateRandomString(8);
          let hash = await bcrypt.hash(pass, 10);
          
          const panPath = req.files?.panFile ? `/documents/${req.files.panFile[0].filename}` : '';
          const aadharPath = req.files?.aadharFile ? `/documents/${req.files.aadharFile[0].filename}` : '';
          const selfiePath = req.files?.selfieFile ? `/documents/${req.files.selfieFile[0].filename}` : '';
          
          let user = User({
            email: formData.email,
            kycId: kycId,
            password: hash,
          });
          const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET);
          await user.save();
          
          try {
            await transporter.sendMail({
              from: "eKYC Portal <ayushtest935@gmail.com>",
              to: user.email,
              replyTo: "ayushtest935@gmail.com",
              subject: "KYC credentials",
              html: `<h4><span style="font-size:16px">Email</span>:&nbsp; ${user.email}</h4>
                              <h4><span style="font-size:16px">Password</span>:&nbsp; ${pass}</h4>
                              <h4><span style="font-size:16px">KYC-ID</span>:&nbsp; ${user.kycId}</h4>`,
            });
          } catch (emailError) {
            console.error("Email error (registration still successful):", emailError);
          }
          
          return res.status(200).json({
            message: "Registered Successfully (Blockchain registration skipped due to error)",
            data: {
              user,
              token: token,
            },
            success: true,
          });
        } catch (fallbackError) {
          console.error("Fallback registration also failed:", fallbackError);
        }
      }
    }
    
    res.status(500).json({
      error: err.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.login = async (req, res) => {
  try {
    if (req.body.sender == "client") {
      let user = await User.findOne({ email: req.body.email });
      // if (!user || !(req.body.password == user.password)){
      if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(400).json({
          message: "Invalid email or password",
          success: false,
        });
      }
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET);
      res.status(200).json({
        message: "User logged in successfully",
        data: {
          token,
        },
        success: true,
      });
    } else if (req.body.sender == "bank") {
      let bank = await Bank.findOne({ email: req.body.email });
      if (!bank || !(await bcrypt.compare(req.body.password, bank.password))) {
      // if (!bank || !(req.body.password == bank.password)) {
        return res.status(400).json({
          message: "Invalid email or password",
          success: false,
        });
      }
      const token = jwt.sign({ email: bank.email }, process.env.JWT_SECRET);
      res.status(200).json({
        message: "Bank logged in successfully",
        data: {
          bank: {
            email: bank.email,
            ethAddress: bank.ethAddress,
          },
          token,
        },
        success: true,
      });
    } else if(req.body.sender == "bank"){
      
    } else {
      res.status(400).json({
        message: "Sender not specified!",
        success: false,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.request = async (req, res) => {
  try {
    const user = req.user;
    const { bAddress, response } = req.body;
    const receipt = await handelRequest(user.kycId, bAddress, response);
    res.status(200).json({
      transactionHash: receipt.transactionHash,
      message: "Response sent successfuly",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.getClientData = async (req, res) => {
  try {
    const user = req.user;
    const bcData = await getDetails(user.kycId);
    res.status(200).json({
      message: "Data Fetched from Blockchain",
      data: {
        email: user.email,
        kycId: user.kycId,
        name: bcData.name,
        phone: bcData.phone,
        address: bcData.customerAddress,
        gender: bcData.gender,
        dob: bcData.dob,
        pan: bcData.PAN,
        records: bcData.records,
        requestList: bcData.requestList,
        approvedBanks: bcData.approvedBanks,
        kycHistory: bcData.kycHistory,
        kycStatus: bcData.kycStatus,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.getBankList = async (req, res) => {
  try {
    const user = req.user;
    const bankList = await getReqList(user.kycId);
    res.status(200).json({
      message: "Data Fetched from Blockchain",
      data: {
        pendingBanks: bankList.pendingBanks,
        approvedBanks: bankList.approvedBanks,
      },
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.updateRecord = async (req, res) => {
  try {
    // Handle file upload if file is provided
    let recordData = req.body.record_data;
    if (req.files && req.files.documentFile) {
      const filePath = `/documents/${req.files.documentFile[0].filename}`;
      // If record_data is JSON string (for video_kyc with verdict), merge it
      if (req.body.record_data) {
        try {
          const existingData = JSON.parse(req.body.record_data);
          existingData.image = filePath;
          recordData = JSON.stringify(existingData);
        } catch (e) {
          // If not JSON, just use file path
          recordData = filePath;
        }
      } else {
        recordData = filePath;
      }
    }
    
    let t = await updateRecordBC(req.user.kycId, req.body.record_type, recordData);    
    res.status(200).json({
      message: "Data Updated Successfully",
      filePath: req.files?.documentFile ? `/documents/${req.files.documentFile[0].filename}` : null,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.updateSocket = async (req, res) => {
  try {    
    let user = req.user
    await User.updateOne({ _id: req.user._id },{ $set: { socket: req.body.socket }});
    res.status(200).json({
      message: "Data Updated Successfully",      
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};

module.exports.getSocket = async (req, res) => {
  try {    
    let user = await User.findOne({ kycId: req.body.kycId });
    if(!user || !user.socket){
      return res.status(400).json({
        message: "No user found",      
        success: false,
      });
    }
    res.status(200).json({
      socket : user.socket,
      message: "Fetched Successfuly",      
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      message: "Something went wrong",
      success: false,
    });
  }
};