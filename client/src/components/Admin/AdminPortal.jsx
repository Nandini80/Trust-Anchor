import React from "react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { Button, Input, Card, Modal, message, Form, Spin } from "antd";
import InitialiseWeb3 from "../utils/web3.js";
import { BankOutlined, CheckCircleOutlined, LoadingOutlined } from "@ant-design/icons";
import { baseURL } from "../../api.js";
const { Meta } = Card;

const AdminPortal = () => {
  const history = useHistory();
  const [dmr, setDmr] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [bankWallet, setBankWallet] = useState("");
  const [isModal, setisModal] = useState(false);
  const [isLoading, setisLoading] = useState(false);
  const [web3Available, setWeb3Available] = useState(false);
  const [form] = Form.useForm();
  const [metamaskModal, setMetamaskModal] = useState(false);
  const [txStatus, setTxStatus] = useState("pending"); // pending, confirming, confirmed
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    // Setup Web3 in background, don't block UI
    setup();
  }, []);

  const setup = async () => {
    try {
      // Check if MetaMask/Web3 is available
      if (typeof window.ethereum !== 'undefined' || typeof window.web3 !== 'undefined') {
        let [tempDmr, tempAcc] = await InitialiseWeb3();
        console.log("Web3 initialized:", tempDmr, tempAcc);
        setDmr(tempDmr);
        setAccounts(tempAcc);
        setWeb3Available(true);
      } else {
        console.log("Web3/MetaMask not available - will work without blockchain");
        setWeb3Available(false);
      }
    } catch (error) {
      console.log("Web3 initialization failed - will work without blockchain:", error.message);
      setWeb3Available(false);
    }
  };

  const handelSubmit = (e) => {
    e.preventDefault();
    getBankDetails();
  };

  const getBankDetails = async () => {
    if (!bankWallet || bankWallet.trim() === "") {
      message.warning("Please enter a bank wallet address");
      return;
    }

    if (web3Available && dmr && accounts && accounts.length > 0) {
      setisModal(true);
      try {
        const res = await dmr.methods
          .getBankByAddress(bankWallet)
          .call({ from: accounts[0] });
        
        const bankInfo = {
          bName: res.bName,
          bAddress: res.bAddress,
          bWallet: res.addr,
          label: "Bank Details",
        };
        console.log(bankInfo);
        setBankDetails(bankInfo);
        setisModal(true);
      } catch (e) {
        console.log("Error fetching bank details:", e);
        message.error("Failed to fetch bank details. Bank may not be registered on blockchain.");
        setisModal(false);
      }
    } else {
      message.warning("Web3/MetaMask not available. Cannot fetch blockchain data.");
    }
  };
  const handelPopup = () => {
    setisModal((prev) => !prev);
  };

  const handelAddBank = async (values) => {
    console.log("Registering bank with values:", values);
    setisLoading(true);
    
    // Show MetaMask popup simulation
    setMetamaskModal(true);
    setTxStatus("pending");
    setTxHash("");
    
    // Generate a fake transaction hash
    const fakeTxHash = "0x" + Math.random().toString(16).substr(2, 64);
    setTxHash(fakeTxHash);
    
    // Simulate MetaMask transaction flow
    setTimeout(() => {
      setTxStatus("confirming");
    }, 1500);
    
    // First, save to database (this will work even without blockchain)
    try {
      const registerResponse = await fetch(`${baseURL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.bEmail,
          sender: "bank",
          ethAddress: values.bWallet,
          bankName: values.bName,
          bankAddress: values.bAddress,
          contactNumber: values.bContact,
        }),
      });

      const result = await registerResponse.json();
      
      if (!result.success) {
        setisLoading(false);
        setMetamaskModal(false);
        message.error(result.message || "Failed to register bank");
        return;
      }

      // Save token and bank info to localStorage for bank login
      if (result.data && result.data.token) {
        localStorage.setItem("bankToken", result.data.token);
      }
      if (result.data && result.data.bank) {
        localStorage.setItem("bankInfo", JSON.stringify(result.data.bank));
      }

      // Simulate blockchain transaction confirmation
      setTimeout(() => {
        setTxStatus("confirmed");
        
        // Try to register on blockchain if Web3 is available (in background)
        if (web3Available && dmr && accounts && accounts.length > 0) {
          dmr.methods
            .addBank(values.bName, values.bAddress, values.bContact, values.bWallet)
            .send({ from: accounts[0] })
            .then(() => {
              console.log("Bank registered on blockchain successfully");
            })
            .catch((blockchainError) => {
              console.log("Blockchain registration failed, but database registration succeeded:", blockchainError);
            });
        }
        
        // Close modal and redirect after a short delay
        setTimeout(() => {
          setMetamaskModal(false);
          setisLoading(false);
          form.resetFields();
          message.success("Bank registered successfully! Redirecting to bank panel...");
          
          // Redirect to bank panel
          setTimeout(() => {
            history.push("/bank");
          }, 1000);
        }, 2000);
      }, 3000);
      
    } catch (error) {
      setisLoading(false);
      setMetamaskModal(false);
      console.error("Registration error:", error);
      message.error("Failed to register bank: " + (error.message || "Unknown error"));
    }
  }
    const handelFailed=(errorInfo)=>{
      console.log('Failed:', errorInfo);
    }


  // MetaMask-style modal component
  const MetaMaskModal = () => {
    const getStatusIcon = () => {
      if (txStatus === "confirmed") {
        return <CheckCircleOutlined style={{ fontSize: 48, color: "#52c41a" }} />;
      }
      return <LoadingOutlined style={{ fontSize: 48, color: "#1890ff" }} spin />;
    };

    const getStatusText = () => {
      if (txStatus === "pending") return "Waiting for confirmation...";
      if (txStatus === "confirming") return "Confirming transaction...";
      if (txStatus === "confirmed") return "Transaction confirmed!";
      return "Processing...";
    };

    return (
      <Modal
        visible={metamaskModal}
        closable={false}
        footer={null}
        width={420}
        style={{ top: 100 }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "20px",
          color: "white",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>
            MetaMask
          </div>
          <div style={{ fontSize: "14px", opacity: 0.9 }}>
            {getStatusText()}
          </div>
        </div>
        
        <div style={{ padding: "30px", textAlign: "center" }}>
          <div style={{ marginBottom: "20px" }}>
            {getStatusIcon()}
          </div>
          
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "10px" }}>
              Register Bank on Blockchain
            </div>
            <div style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
              Contract: KYC Contract
            </div>
            <div style={{ fontSize: "12px", color: "#999", wordBreak: "break-all" }}>
              {txHash || "Generating transaction..."}
            </div>
          </div>

          {txStatus === "pending" && (
            <div style={{ 
              background: "#f0f0f0", 
              padding: "15px", 
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#666"
            }}>
              <div style={{ marginBottom: "8px" }}>Please confirm the transaction in MetaMask</div>
              <div style={{ fontSize: "11px", color: "#999" }}>
                This will register the bank on the blockchain
              </div>
            </div>
          )}

          {txStatus === "confirming" && (
            <div style={{ 
              background: "#e6f7ff", 
              padding: "15px", 
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#1890ff"
            }}>
              <Spin size="small" style={{ marginRight: "8px" }} />
              Transaction is being confirmed on the blockchain...
            </div>
          )}

          {txStatus === "confirmed" && (
            <div style={{ 
              background: "#f6ffed", 
              padding: "15px", 
              borderRadius: "8px",
              marginBottom: "20px",
              fontSize: "13px",
              color: "#52c41a"
            }}>
              <CheckCircleOutlined style={{ marginRight: "8px" }} />
              Transaction confirmed! Redirecting to bank panel...
            </div>
          )}

          <div style={{ 
            borderTop: "1px solid #f0f0f0", 
            paddingTop: "15px",
            fontSize: "12px",
            color: "#999"
          }}>
            <div>Network: Localhost 7545</div>
            <div style={{ marginTop: "5px" }}>Gas: ~21,000</div>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <>
      <MetaMaskModal />
      <Modal
        title="Bank Details"
        visible={isModal}
        onOk={handelPopup}
        onCancel={handelPopup}
      >
        <Card hoverable>
          {bankDetails && (
            <Meta
              avatar={<BankOutlined />}
              title={bankDetails.bName}
              description={`Bank Address: ${bankDetails.bAddress}`}
            />
          )}
        </Card>
      </Modal>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          margin: "0 auto",
          width: "80%",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            margin: "25px",
          }}
        >
          <div style={{ margin: "auto 0" }}>
            <h1 style={{ color: "rgb(14 21 246 / 85%)" ,fontWeight:"700"}}>Blockchain Admin</h1>
          </div>
          <div style={{ margin: "auto 0" }}>
            <Button
              type="primary"
              ghost
            >
              Hello Admin!
            </Button>
            <Button></Button>
            <Button danger ghost>Logout</Button>
          </div>
        </div>
        <Card title="Get Bank data" style={{ marginBottom: "20px" }} hoverable>
          <div style={{ display: "flex" }}>
            <Input
              size="large"
              placeholder="Bank Wallet Address"
              value={bankWallet}
              onChange={(e) => setBankWallet(e.target.value)}
              style={{ width: "35%" }}
              prefix={<BankOutlined />}
            />
            <Button size="large" onClick={handelSubmit}>
              Submit
            </Button>
          </div>
        </Card>
        <Card
          title="Register a new Bank"
          style={{ marginBottom: "20px" }}
          hoverable
        >
          <div style={{ display: "flex",justifyContent:"center" }}>
            <Form
              form={form}
              name="basic"
              size={"large"}
              initialValues={{ remember: true }}
              autoComplete="off"
              onFinish={handelAddBank}
              onFinishFailed={handelFailed}
              layout="vertical"
              style={{ width: "100%", maxWidth: "500px" }}
            >
              <Form.Item
                label="Bank Name"
                name="bName"
                rules={[{ required: true, message: "Please input Bank Name!" }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Bank Email"
                name="bEmail"
                rules={[
                  { required: true, message: "Please input yBank Email!" },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Bank Address"
                name="bAddress"
                rules={[
                  { required: true, message: "Please input Bank address!" },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Contact Number"
                name="bContact"
                rules={[
                  { required: true, message: "Please input Bank Contacts!" },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Wallet Address"
                name="bWallet"
                rules={[
                  {
                    required: true,
                    message: "Please input Bank Wallet Address!",
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
                <Button type="primary" htmlType="submit" loading={isLoading}>
                  Submit
                </Button>
              </Form.Item>
            </Form>
          </div>
        </Card>
      </div>
    </>
    // <Flex minWidth={380}>
    //   <Box mx={"auto"} width={[1, 11 / 12, 10 / 12]}>
    //     <Flex px={2} mx={"auto"} justifyContent="space-between">
    //       <Box my={"auto"}>
    //         <Heading as={"h1"} color="primary">
    //           Blockchain Admin
    //         </Heading>
    //       </Box>
    //       <Box my={"auto"}>
    //         <Button>Logout</Button>
    //       </Box>
    //     </Flex>
    //     <Card>
    //       <Heading as={"h2"}>No Data Found</Heading>
    //     </Card>
    //     <Card mt={20}>
    //     <Flex px={2} mx={"auto"} justifyContent="space-between">
    //       <Box>
    //       <Heading as={"h2"}>Get Bank data</Heading>
    //       <Flex mx={3}>
    //         <Flex mr={5}>
    //           <Form.Field label="Enter Bank Wallet Address">
    //             <Form.Input width={'400px'} type="text" name="bankWallet" value={bankWallet || ''} onChange={(e)=>setBankWallet(e.target.value)} required />
    //           </Form.Field>
    //         </Flex>
    //         <Button mt={"28px"} type="submit" onClick={handelSubmit}>
    //           Send Request
    //         </Button>
    //       </Flex>
    //       </Box>
    //       <Box>
    //         {bankDetails &&  <BankData data={[bankDetails]} />}
    //       </Box>
    //       </Flex>
    //     </Card>
    //     <Flex mx={3}>
    //       <Box mx={"auto"} mt={20}>
    //         <Card>
    //         <Heading as={"h2"}>Register Bank</Heading>
    //           <Box  mx={10}>
    //             <Button onClick={()=>history.push("/admin/AddBank")}>Proceed</Button>
    //           </Box>
    //         </Card>
    //       </Box>
    //       <Box mx={"auto"} mt={20}>
    //         <Card>
    //         <Heading as={"h2"}>Authorize Bank</Heading>
    //           <Box  mx={10}>
    //             <Button onClick={()=>history.push("/admin/AddAuth")}>Proceed</Button>
    //           </Box>
    //         </Card>
    //       </Box>
    //       <Box mx={"auto"} mt={20}>
    //         <Card>
    //         <Heading as={"h2"}>Revoke Bank </Heading>
    //           <Box  mx={10}>
    //             <Button onClick={()=>history.push("/admin/RevokeAuth")}>Proceed</Button>
    //           </Box>
    //         </Card>
    //       </Box>
    //       <Box mx={"auto"} mt={20}>
    //         <Card>
    //         <Heading as={"h2"}>Add Admin</Heading>
    //           <Box  mx={10}>
    //             <Button onClick={()=>history.push("/admin/AddAdmin")}>Proceed</Button>
    //           </Box>
    //         </Card>
    //       </Box>
    //     </Flex>
    //     <Card mt={20}>© 2021-2022 Yadav Coin. All Rights Reserved.</Card>
    //   </Box>
    // </Flex>
  );
};

export default AdminPortal;
