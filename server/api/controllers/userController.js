const User = require("../../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { gmail } = require("googleapis/build/src/apis/gmail");
const transporter = require("../../config/nodemailer");
const generateRandomString = require("../../utils/random");
const Bank = require("../../models/Bank");
const BankRequest = require("../../models/BankRequest");
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
      // Save all user data and document paths to database
      // Note: socket field is not set - it will be undefined, which is fine with sparse index
      user = User({
        email: formData.email,
        kycId: kycId,
        password: hash,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        gender: formData.gender,
        dob: formData.dob,
        PANno: formData.PANno,
        panFile: panPath,
        aadharFile: aadharPath,
        selfieFile: selfiePath,
        geo: formData.geo,
        // socket is intentionally not set - will be undefined
      });
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET || 'dev_jwt_secret');
      
      try {
        await user.save();
        console.log("User saved successfully with data:", {
          email: user.email,
          kycId: user.kycId,
          name: user.name,
          phone: user.phone,
          address: user.address,
          panFile: user.panFile,
          aadharFile: user.aadharFile,
          selfieFile: user.selfieFile,
        });
      } catch (saveError) {
        // Handle duplicate key error for socket field
        if (saveError.code === 11000 && saveError.keyPattern && saveError.keyPattern.socket) {
          console.error("Socket index error detected. Please run: node server/scripts/fixSocketIndex.js");
          // Try to save again without socket field explicitly
          user = User({
            email: formData.email,
            kycId: kycId,
            password: hash,
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            gender: formData.gender,
            dob: formData.dob,
            PANno: formData.PANno,
            panFile: panPath,
            aadharFile: aadharPath,
            selfieFile: selfiePath,
            geo: formData.geo,
          });
          // Remove socket from the document if it exists
          user.socket = undefined;
          await user.save();
          console.log("User saved successfully after socket fix");
        } else {
          throw saveError;
        }
      }
      
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
      
      // Save all bank data to database
      bank = Bank({
        email: req.body.email,
        ethAddress: req.body.ethAddress,
        password: hash,
        bankName: req.body.bankName || "",
        bankAddress: req.body.bankAddress || "",
        contactNumber: req.body.contactNumber || "",
      });
      const token = jwt.sign({ email: bank.email }, process.env.JWT_SECRET || 'dev_jwt_secret');
      await bank.save();
      console.log("Bank saved successfully with data:", {
        email: bank.email,
        ethAddress: bank.ethAddress,
        bankName: bank.bankName,
        bankAddress: bank.bankAddress,
        contactNumber: bank.contactNumber,
      });
      
      // Try to send email, but don't fail registration if email fails
      try {
        await transporter.sendMail({
          from: "eKYC Portal <ayushtest935@gmail.com>",
          to: bank.email,
          replyTo: "ayushtest935@gmail.com",
          subject: "Bank credentials",
          html: `<p><span style="font-size:16px">Email</span>:&nbsp; ${bank.email}</p>
                          <p><span style="font-size:16px">Password</span>:&nbsp; ${pass}</p>`,
        });
        console.log("Bank registration email sent successfully to:", bank.email);
      } catch (emailError) {
        console.error("========================================");
        console.error("EMAIL ERROR (Bank registration still successful):");
        console.error("Error message:", emailError.message);
        console.error("Error code:", emailError.code);
        console.error("========================================");
        // Continue with registration even if email fails
      }
      
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
          const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET || 'dev_jwt_secret');
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
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET || 'dev_jwt_secret');
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
      const token = jwt.sign({ email: bank.email }, process.env.JWT_SECRET || 'dev_jwt_secret');
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

    const isApproved =
      response === true ||
      response === "true" ||
      response === 1 ||
      response === "1";

    let receipt = null;
    try {
      receipt = await handelRequest(user.kycId, bAddress, response);
    } catch (blockchainError) {
      console.log(
        "Blockchain request handling failed, using database fallback:",
        blockchainError.message
      );
    }

    const bankRequest = await BankRequest.findOne({
      clientKycId: user.kycId,
      $or: [
        { bankEthAddress: bAddress },
        { bankEmail: bAddress },
      ],
    });

    if (bankRequest) {
      bankRequest.status = isApproved ? "approved" : "rejected";
      bankRequest.history.push({
        action: "client_response",
        message: isApproved ? "Client approved the request" : "Client rejected the request",
      });
      await bankRequest.save();
    }

    res.status(200).json({
      transactionHash: receipt ? receipt.transactionHash : null,
      message: isApproved
        ? "Request approved successfully"
        : "Request declined successfully",
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
    // req.user from passport JWT should already have the full user, but let's fetch fresh from DB to be sure
    const userFromJWT = req.user;
    const user = await User.findOne({ email: userFromJWT.email });
    
    if (!user) {
      console.error("User not found for email:", userFromJWT.email);
      return res.status(404).json({
        error: "User not found",
        message: "User not found in database",
        success: false,
      });
    }
    
    console.log("Fetching client data for user:", {
      email: user.email,
      kycId: user.kycId,
      hasName: !!user.name,
      hasPhone: !!user.phone,
      hasAddress: !!user.address,
      hasPanFile: !!user.panFile,
      hasAadharFile: !!user.aadharFile,
      hasSelfieFile: !!user.selfieFile,
    });
    
    // Try to get data from blockchain first, but fallback to database if it fails
    let bcData = null;
    try {
      bcData = await getDetails(user.kycId);
      console.log("Blockchain data retrieved successfully");
    } catch (blockchainError) {
      console.log("Blockchain data not available, using database data:", blockchainError.message);
      // Continue to use database data
    }
    
    // If blockchain data exists, use it; otherwise use database data
    const userData = bcData ? {
      email: user.email,
      kycId: user.kycId,
      name: bcData.name,
      phone: bcData.phone,
      address: bcData.customerAddress,
      gender: bcData.gender,
      dob: bcData.dob,
      pan: bcData.PAN,
      records: bcData.records || [],
      requestList: bcData.requestList || [],
      approvedBanks: bcData.approvedBanks || [],
      kycHistory: bcData.kycHistory || [],
      kycStatus: bcData.kycStatus || "0",
    } : {
      // Fallback to database data
      email: user.email,
      kycId: user.kycId,
      name: user.name || "",
      phone: user.phone || "",
      address: user.address || "",
      gender: user.gender || "",
      dob: user.dob || "",
      pan: user.PANno || "",
      // Format records as expected by frontend: [["Document Name", "path"], ...]
      records: [
        ["PAN Card", user.panFile || ""],
        ["Aadhar Card", user.aadharFile || ""],
        ["Selfie", user.selfieFile || ""],
      ],
      requestList: [],
      approvedBanks: [],
      kycHistory: [],
      kycStatus: "0", // Not initiated
    };
    
    console.log("Sending user data to client:", {
      name: userData.name,
      phone: userData.phone,
      address: userData.address,
      recordsCount: userData.records.length,
      records: userData.records,
    });
    
    res.status(200).json({
      message: bcData ? "Data Fetched from Blockchain" : "Data Fetched from Database",
      data: userData,
      success: true,
    });
  } catch (error) {
    console.error("getClientData error:", error);
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
    let bankList = null;
    try {
      bankList = await getReqList(user.kycId);
    } catch (blockchainError) {
      console.log(
        "Blockchain data not available for bank list, using database requests:",
        blockchainError.message
      );
    }

    if (!bankList) {
      const pendingRequests = await BankRequest.find({
        clientKycId: user.kycId,
        status: "pending",
      }).sort({ createdAt: -1 });

      const approvedRequests = await BankRequest.find({
        clientKycId: user.kycId,
        status: "approved",
      }).sort({ updatedAt: -1 });

      const mapRequest = (request) => [
        request.bankName || request.bankEmail,
        request.bankEthAddress || request.bankEmail,
      ];

      return res.status(200).json({
        message: "Data Fetched from Database",
        data: {
          pendingBanks: pendingRequests.map(mapRequest),
          approvedBanks: approvedRequests.map(mapRequest),
        },
        success: true,
      });
    }

    res.status(200).json({
      message: "Data Fetched from Blockchain",
      data: {
        pendingBanks: bankList?.pendingBanks || [],
        approvedBanks: bankList?.approvedBanks || [],
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

module.exports.getBankProfile = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // req.user might already contain the bank document, but fetch fresh to avoid stale data
    const bank = await Bank.findOne({ email: req.user.email });
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Bank profile not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        email: bank.email,
        bankName: bank.bankName || "",
        bankAddress: bank.bankAddress || "",
        contactNumber: bank.contactNumber || "",
        ethAddress: bank.ethAddress || "",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch bank profile",
    });
  }
};

module.exports.getBankRequests = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const pending = await BankRequest.find({
      bankEmail: req.user.email,
      status: "pending",
    }).sort({ createdAt: -1 });

    const approved = await BankRequest.find({
      bankEmail: req.user.email,
      status: "approved",
    }).sort({ updatedAt: -1 });

    const allRequests = [...pending, ...approved];
    const kycIds = allRequests.map((request) => request.clientKycId);
    const clients = await User.find({ kycId: { $in: kycIds } });
    const clientMap = new Map(
      clients.map((client) => [client.kycId, client])
    );

    res.status(200).json({
      success: true,
      data: {
        pending: pending.map((request) => ({
          id: request._id,
          clientKycId: request.clientKycId,
           clientName: clientMap.get(request.clientKycId)?.name || "",
           clientEmail: clientMap.get(request.clientKycId)?.email || "",
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        })),
        approved: approved.map((request) => ({
          id: request._id,
          clientKycId: request.clientKycId,
          clientName: clientMap.get(request.clientKycId)?.name || "",
          clientEmail: clientMap.get(request.clientKycId)?.email || "",
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch bank requests",
    });
  }
};

module.exports.createBankRequest = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const { clientKycId } = req.body;
    if (!clientKycId) {
      return res.status(400).json({
        success: false,
        message: "Client KYC ID is required",
      });
    }

    const client = await User.findOne({ kycId: clientKycId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "No client found with the provided KYC ID",
      });
    }

    const existing = await BankRequest.findOne({
      bankEmail: req.user.email,
      clientKycId,
      status: { $in: ["pending", "approved"] },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          existing.status === "pending"
            ? "A request for this client is already pending"
            : "This client has already approved access for your bank",
      });
    }

    const request = await BankRequest.create({
      bankEmail: req.user.email,
      bankName: req.user.bankName || req.body.bankName || req.user.email,
      bankEthAddress: req.user.ethAddress || "",
      clientKycId,
      status: "pending",
      history: [
        {
          action: "request_created",
          message: "Bank requested access to client data",
        },
      ],
    });

    res.status(200).json({
      success: true,
      message: "Access request created successfully",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create bank request",
    });
  }
};

module.exports.accessClientData = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const { clientKycId } = req.body;
    if (!clientKycId) {
      return res.status(400).json({
        success: false,
        message: "Client KYC ID is required",
      });
    }

    const bankRequest = await BankRequest.findOne({
      bankEmail: req.user.email,
      clientKycId,
    });

    if (!bankRequest) {
      return res.status(404).json({
        success: false,
        message: "No request found for this client",
      });
    }

    if (bankRequest.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Client has not approved access yet",
      });
    }

    const client = await User.findOne({ kycId: clientKycId });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Build KYC history from BankRequest history
    // Format should match blockchain: [bankName, remarks, verdict, timestamp]
    const kycHistory = [];
    if (bankRequest.history && bankRequest.history.length > 0) {
      // Extract KYC history entries - remarks are stored in message field
      bankRequest.history.forEach((entry) => {
        // Include both regular KYC and vKYC entries
        if (entry.action === "kyc_approved" || entry.action === "kyc_rejected" ||
            entry.action === "vkyc_approved" || entry.action === "vkyc_rejected") {
          const verdict = (entry.action === "kyc_approved" || entry.action === "vkyc_approved") ? "1" : "2";
          // Use timestamp field if available (for vKYC), otherwise use at field
          const timestamp = entry.timestamp 
            ? new Date(entry.timestamp).getTime() 
            : (entry.at ? new Date(entry.at).getTime() : Date.now());
          // Use remarks from message field (stored when status was updated)
          kycHistory.push([
            bankRequest.bankName || req.user.bankName || req.user.email,
            entry.message || bankRequest.remarks || "",
            verdict,
            timestamp.toString(),
          ]);
        }
      });
    }

    const clientData = {
      email: client.email,
      kycId: client.kycId,
      name: client.name || "",
      phone: client.phone || "",
      address: client.address || "",
      gender: client.gender || "",
      dob: client.dob || "",
      pan: client.PANno || "",
      records: [
        ["PAN Card", client.panFile || ""],
        ["Aadhar Card", client.aadharFile || ""],
        ["Selfie", client.selfieFile || ""],
      ],
      kycHistory: kycHistory,
      kycStatus: bankRequest.remarks ? (kycHistory.length > 0 && kycHistory[kycHistory.length - 1][2] === "1" ? "1" : "2") : "1",
    };

    bankRequest.history.push({
      action: "data_accessed",
      message: "Bank viewed client data",
    });
    await bankRequest.save();

    res.status(200).json({
      success: true,
      data: clientData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to access client data",
    });
  }
};

module.exports.updateKycStatus = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const { clientKycId, remarks, verdict } = req.body;

    if (!clientKycId || !remarks || verdict === undefined) {
      return res.status(400).json({
        success: false,
        message: "Client KYC ID, remarks, and verdict are required",
      });
    }

    // Validate verdict: 1 = Accept, 2 = Reject
    if (verdict !== 1 && verdict !== 2) {
      return res.status(400).json({
        success: false,
        message: "Verdict must be 1 (Accept) or 2 (Reject)",
      });
    }

    // Check if bank has access to this client
    const bankRequest = await BankRequest.findOne({
      bankEmail: req.user.email,
      clientKycId,
      status: "approved",
    });

    if (!bankRequest) {
      return res.status(403).json({
        success: false,
        message: "No approved access found for this client",
      });
    }

    // Update BankRequest with remarks
    bankRequest.remarks = remarks;
    bankRequest.history.push({
      action: verdict === 1 ? "kyc_approved" : "kyc_rejected",
      message: remarks, // Store remarks in message field
    });
    await bankRequest.save();

    res.status(200).json({
      success: true,
      message: verdict === 1 ? "KYC approved successfully" : "KYC rejected successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update KYC status",
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

module.exports.getKycIdFromSocket = async (req, res) => {
  try {
    const { socket } = req.body;
    if (!socket) {
      return res.status(400).json({
        success: false,
        message: "Socket ID is required",
      });
    }

    const user = await User.findOne({ socket });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No user found with this socket ID",
      });
    }

    res.status(200).json({
      success: true,
      kycId: user.kycId,
      message: "KYC ID fetched successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Something went wrong",
    });
  }
};

module.exports.submitVkycVerdict = async (req, res) => {
  try {
    if (!req.user || req.user.userType !== "bank") {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const { clientKycId, verdict, remarks } = req.body;

    if (!clientKycId || !remarks || !verdict) {
      return res.status(400).json({
        success: false,
        message: "Client KYC ID, remarks, and verdict are required",
      });
    }

    // Validate verdict: "1" or "2" (Accept or Reject)
    const verdictNum = parseInt(verdict);
    if (verdictNum !== 1 && verdictNum !== 2) {
      return res.status(400).json({
        success: false,
        message: "Verdict must be 1 (Accept) or 2 (Reject)",
      });
    }

    // Check if bank has access to this client
    const bankRequest = await BankRequest.findOne({
      bankEmail: req.user.email,
      clientKycId,
      status: "approved",
    });

    if (!bankRequest) {
      return res.status(403).json({
        success: false,
        message: "No approved access found for this client",
      });
    }

    // Handle screenshot file if provided
    let screenshotPath = null;
    if (req.files && req.files.documentFile) {
      screenshotPath = `/documents/${req.files.documentFile[0].filename}`;
    }

    // Update BankRequest with remarks and verdict
    bankRequest.remarks = remarks;
    bankRequest.history.push({
      action: verdictNum === 1 ? "vkyc_approved" : "vkyc_rejected",
      message: remarks,
      screenshot: screenshotPath,
      timestamp: new Date(),
    });
    await bankRequest.save();

    // Also update client's record if screenshot was provided
    if (screenshotPath && clientKycId) {
      try {
        const client = await User.findOne({ kycId: clientKycId });
        if (client) {
          // Add video KYC record
          const recordData = JSON.stringify({
            verdict: verdictNum === 1 ? "accepted" : "rejected",
            remarks: remarks,
            image: screenshotPath,
            timestamp: new Date().toISOString(),
          });
          await updateRecordBC(clientKycId, "video_kyc", recordData);
        }
      } catch (err) {
        console.log("Error updating client record:", err);
        // Don't fail the request if this fails
      }
    }

    res.status(200).json({
      success: true,
      message: verdictNum === 1 ? "KYC approved successfully" : "KYC rejected successfully",
      screenshotPath: screenshotPath,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit vKYC verdict",
    });
  }
};
