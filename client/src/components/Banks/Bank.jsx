import React from "react";
import { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import InitialiseWeb3 from "../utils/web3.js";

import VerifyClient from "./VerifyClient.jsx";
import { Card, Button, Input, Modal, message } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { baseURL } from "../../api";
import ClientDataCard from "../Client/ClientData";

const Bank = () => {
  const history = useHistory();
  const [dmr, setDmr] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [pendingClientRequests, setPendingClientRequests] = useState([]);
  const [approvedClients, setApprovedClients] = useState([]);
  const [customerKycId, setCustomerKycId] = useState("");
  const [customerKycIdData, setCustomerKycIdData] = useState("");
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [isLoading, setisLoading] = useState(false);
  const [userDataFooters, setUserDataFooters] = useState([]);
  const [addRemPop, setaddRemPop] = useState(false);
  const [remarks, setremarks] = useState("");
  const [usingBlockchain, setUsingBlockchain] = useState(false);

  const token = localStorage.getItem("bankToken");
  const authHeaders = token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : { "Content-Type": "application/json" };

  useEffect(() => {
    setup();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    fetchBankProfile();
    fetchBankRequests();
    
    // Check if there's a kycId in URL params (from vKYC redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const kycId = urlParams.get('kycId');
    if (kycId) {
      // Remove from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      // Fetch and show client data
      setTimeout(() => {
        fetchClientDataDetails(kycId);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Update footer buttons when loading state or clientData changes
  useEffect(() => {
    if (clientData && isPopupOpen) {
      setUserDataFooters([
        <Button
          key="start-vkyc"
          type="primary"
          loading={isLoading}
          onClick={() => handelStartvKYC(clientData.kycId)}
        >
          Start vKYC
        </Button>,
        <Button key="close" onClick={() => setIsPopupOpen(false)}>
          Close
        </Button>,
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, clientData, isPopupOpen]);

  const setup = async () => {
    try {
      let [tempDmr, tempAcc] = await InitialiseWeb3();
      if (tempDmr && tempAcc) {
        setDmr(tempDmr);
        setAccounts(tempAcc);
        setUsingBlockchain(true);
      }
    } catch (error) {
      console.log(
        "Web3/MetaMask not available, continuing with API fallback:",
        error.message
      );
      setUsingBlockchain(false);
    }
  };

  const fetchBankProfile = async () => {
    if (!token) {
      message.error("Please login as bank to continue");
      history.push("/");
      return;
    }
    try {
      const response = await fetch(`${baseURL}/bank/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setBankDetails({
          bName: result.data.bankName,
          bAddress: result.data.bankAddress,
          bWallet: result.data.ethAddress,
          contactNumber: result.data.contactNumber,
        });
      } else {
        message.error(result.message || "Failed to fetch bank profile");
        const localInfo = localStorage.getItem("bankInfo");
        if (localInfo) {
          const parsed = JSON.parse(localInfo);
          setBankDetails({
            bName: parsed.bankName || parsed.email || "",
            bAddress: parsed.bankAddress || "",
            bWallet: parsed.ethAddress || "",
            contactNumber: parsed.contactNumber || "",
          });
        }
      }
    } catch (error) {
      console.log(error);
      message.error("Failed to fetch bank profile");
      const localInfo = localStorage.getItem("bankInfo");
      if (localInfo) {
        const parsed = JSON.parse(localInfo);
        setBankDetails({
          bName: parsed.bankName || parsed.email || "",
          bAddress: parsed.bankAddress || "",
          bWallet: parsed.ethAddress || "",
          contactNumber: parsed.contactNumber || "",
        });
      }
    }
  };

  const fetchBankRequests = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${baseURL}/bank/requests`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setPendingClientRequests(result.data.pending || []);
        setApprovedClients(result.data.approved || []);
      } else {
        message.error(result.message || "Failed to fetch requests");
      }
    } catch (error) {
      console.log(error);
      message.error("Failed to fetch requests");
    }
  };

  const showClientDataPopup = (clientInfo) => {
    togglePopup(clientInfo, [
      <Button
        type="primary"
        onClick={() => handelStartvKYC(clientInfo.kycId)}
      >
        Start vKYC
      </Button>,
      <Button
        type="primary"
        onClick={() => {
          setremarks("");
          setaddRemPop(true);
        }}
      >
        Proceed without vKYC
      </Button>,
      <Button key="close" onClick={() => setIsPopupOpen(false)}>
        Close
      </Button>,
    ]);
  };

  const fetchClientDataDetails = async (kycId) => {
    try {
      const hide = message.loading("Loading client details...", 0);
      const response = await fetch(`${baseURL}/bank/access`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientKycId: kycId }),
      });
      const result = await response.json();
      hide();
      if (result.success) {
        showClientDataPopup(result.data);
        fetchBankRequests();
        return true;
      } else {
        message.error(result.message || "Failed to fetch client data");
        return false;
      }
    } catch (error) {
      console.log(error);
      message.error("Failed to fetch client data");
      return false;
    }
  };

  const getBankDetails = async () => {
    if (dmr && accounts) {
      dmr.methods
        .getBankByAddress(accounts[0])
        .call({ from: accounts[0] })
        .then((res) => {
          const bankInfo = {
            bName: res.bName,
            bAddress: res.bAddress,
            bWallet: res.addr,
            label: "Bank Details",
          };
          setBankDetails(bankInfo);
        })
        .catch((err) => {
          console.log(err);
      });
    }
  };

  const getBankData = async () => {
    if (dmr && accounts) {
      dmr.methods
        .getBankData()
        .call({ from: accounts[0] })
        .then((res) => {
          setPendingClientRequests(res.pendingCustomers);
          setApprovedClients(res.approvedCustomers);
        })
        .catch((err) => {
          console.log(err);
        });
      }
  };

  useEffect(() => {
    if (dmr && accounts) {
      getBankDetails();
      getBankData();
    }
    // eslint-disable-next-line
  }, [dmr, accounts]);

  const handleSendRequest = async (e) => {
    e.preventDefault();
    if (!customerKycId) {
      message.warning("Please enter a client KYC ID");
      return;
    }
    if (!token) {
      message.error("Please login as bank");
      history.push("/");
      return;
    }
    setisLoading(true);

    const hide = message.loading("Waiting for MetaMask confirmation...", 1.5);

    try {
      const response = await fetch(`${baseURL}/bank/request`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ clientKycId: customerKycId }),
      });
      const result = await response.json();
      hide();
      if (result.success) {
        message.success("Request sent! Awaiting client approval.");
        setCustomerKycId("");
        fetchBankRequests();
      } else {
        message.error(result.message || "Failed to send request");
      }
    } catch (error) {
      console.log(error);
      hide();
      message.error("Failed to send request");
    }

    setisLoading(false);
  };

  const handleRequestData = async (e) => {
    e.preventDefault();
    if (!customerKycIdData) {
      message.warning("Please enter a client KYC ID");
      return;
    }
    if (!token) {
      message.error("Please login as bank");
      history.push("/");
      return;
    }
    setisLoading(true);
    message.loading({ content: "Confirming access via MetaMask...", key: "access" });
    const success = await fetchClientDataDetails(customerKycIdData);
    message.destroy("access");
    if (success) {
      message.success("Client data retrieved successfully");
      setCustomerKycIdData("");
    }
    setisLoading(false);
  };

  const handelLogout = () => {
    localStorage.removeItem("bankToken");
    localStorage.removeItem("bankInfo");
    history.push("/");
  };

  const togglePopup = (data, footers) => {

    setClientData(data);
    console.log(data);
    setUserDataFooters(footers);
    setIsPopupOpen((prev) => {
      return !prev;
    });
  };

  const handelStartvKYC = async (kyc) => {
    if (!kyc) {
      message.error("KYC ID is missing");
      return;
    }
    
    setisLoading(true);
    try {
      const response = await fetch(`${baseURL}/getSocket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ kycId: kyc }),
      });
      
      const result = await response.json();
      
      if (result.success && result.socket) {
        // Close the modal before navigating
        setIsPopupOpen(false);
        message.success("Starting vKYC session...");
        history.push(`/agent/video/${result.socket}`);
      } else {
        // More helpful error message
        const errorMsg = result.message || "Failed to start vKYC session";
        if (errorMsg.includes("No user found")) {
          message.warning("Client is not connected. Please ask the client to visit the video page (/client/video) and wait for the connection to be established.", 8);
        } else {
          message.error(errorMsg);
        }
        console.error("vKYC start failed:", result);
      }
    } catch (error) {
      console.error("Error starting vKYC:", error);
      message.error("Failed to start vKYC session. Please try again.");
    } finally {
      setisLoading(false);
    }
  };

  const handleVerdict = async (verdict) => {
    console.log(remarks);
    if (!clientData) {
      message.warning("No client data available");
      return;
    }
    if (!remarks.length) {
      message.warning("Please add remarks");
      return;
    }

    // Use blockchain if available
    if (usingBlockchain && dmr && accounts) {
      dmr.methods
        .updateKycStatus(
          clientData.kycId,
          bankDetails.bName,
          remarks,
          Date.now(),
          verdict
        )
        .send({ from: accounts[0] })
        .then(async (res) => {
          message.success(verdict === 1 ? "KYC approved successfully" : "KYC rejected successfully");
          getBankData();
          handelAddRemarksPopup();
          setremarks("");
          // Refetch client data to show updated history (this will reopen popup with updated data)
          if (clientData && clientData.kycId) {
            const currentKycId = clientData.kycId;
            setIsPopupOpen(false); // Close current popup first
            await fetchClientDataDetails(currentKycId); // This will reopen with updated data
          } else {
            setIsPopupOpen((prev) => {return !prev;});
          }
          fetchBankRequests();
        })
        .catch((err) => {
          console.log(err);
          message.error("Failed to update KYC status");
        });
      return;
    }

    // Use API endpoint when blockchain is not available
    try {
      const response = await fetch(`${baseURL}/bank/update-kyc-status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          clientKycId: clientData.kycId,
          remarks: remarks,
          verdict: verdict,
        }),
      });

      const result = await response.json();
      if (result.success) {
        message.success(result.message || (verdict === 1 ? "KYC approved successfully" : "KYC rejected successfully"));
        handelAddRemarksPopup();
        setremarks("");
        // Refetch client data to show updated history (this will reopen popup with updated data)
        if (clientData && clientData.kycId) {
          const currentKycId = clientData.kycId;
          setIsPopupOpen(false); // Close current popup first
          await fetchClientDataDetails(currentKycId); // This will reopen with updated data
        } else {
          setIsPopupOpen(false);
        }
        fetchBankRequests();
      } else {
        message.error(result.message || "Failed to update KYC status");
      }
    } catch (error) {
      console.log(error);
      message.error("Failed to update KYC status");
    }
  };

  const handelAddRemarksPopup = () => {
    setaddRemPop((prev) => !prev);
  };

  return (
    <>
      <Modal
        title="Client Details"
        width={1100}
        style={{ top: "20px" }}
        visible={isPopupOpen}
        onCancel={() =>
          setIsPopupOpen((prev) => {
            return !prev;
          })
        }
        footer={userDataFooters}
      >
        <Modal
          title="Add Remarks"
          visible={addRemPop}
          onCancel={handelAddRemarksPopup}
          footer={[
            <Button
              type="primary"
              danger
              onClick={() => handleVerdict(2)}
              disabled={remarks.length === 0}
            >
              Reject KYC
            </Button>,
            <Button
              type="primary"
              onClick={() => handleVerdict(1)}
              disabled={remarks.length === 0}
            >
              Accept KYC
            </Button>,
          ]}
        >
          <Input
            placeholder="Enter Remarks"
            value={remarks}
            onChange={(e) => setremarks(e.target.value)}
          />
        </Modal>
        {clientData ? (
          usingBlockchain && dmr && accounts ? (
            <VerifyClient dmr={dmr} accounts={accounts} data={clientData} />
          ) : (
            <ClientDataCard userData={clientData} />
          )
        ) : (
          <div>No client data loaded</div>
        )}
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
            <h1 style={{ color: "rgb(14 21 246 / 85%)", fontWeight: "700" }}>
              vKYC
            </h1>
          </div>
          <div style={{ margin: "auto 0" }}>
            <Button type="primary" ghost>
              Hello Bank!
            </Button>
            <Button></Button>
            <Button danger ghost onClick={handelLogout}>
              Logout
            </Button>
          </div>
        </div>

        <Card title="Bank Details" my={"50px"} hoverable>
          {bankDetails ? (
            <Card type="inner" hoverable>
              <strong>Name:</strong> {bankDetails.bName || "N/A"}
              <br />
              <strong>Address:</strong> {bankDetails.bAddress || "N/A"}
              <br />
              <strong>Contact:</strong> {bankDetails.contactNumber || "N/A"}
              <br />
              <strong>Wallet:</strong> {bankDetails.bWallet || "N/A"}
            </Card>
          ) : (
            "No bank profile found"
          )}
        </Card>
        <Card title="Request Access" style={{ margin: "20px 0" }} hoverable>
          <div style={{ display: "flex" }}>
            <Input
              size="large"
              placeholder="Client KYC ID"
              value={customerKycId}
              onChange={(e) => setCustomerKycId(e.target.value)}
              style={{ width: "20%" }}
              prefix={<UserOutlined />}
            />
            <Button
              size="large"
              loading={isLoading}
              onClick={handleSendRequest}
            >
              Send Request
            </Button>
          </div>
        </Card>

        <Card title="Access Data" style={{ margin: "20px 0" }} hoverable>
          <div style={{ display: "flex" }}>
            <Input
              size="large"
              placeholder="Client KYC ID"
              value={customerKycIdData}
              onChange={(e) => setCustomerKycIdData(e.target.value)}
              style={{ width: "20%" }}
              prefix={<UserOutlined />}
            />
            <Button
              size="large"
              loading={isLoading}
              onClick={handleRequestData}
            >
              Access
            </Button>
          </div>
        </Card>

        <Card
          title="Pending Requests"
          style={{ marginBottom: "20px" }}
          hoverable
        >
          {pendingClientRequests.length > 0
            ? pendingClientRequests.map((req, i) => {
                return (
                  <Card.Grid
                    style={{
                      width: "25%",
                      textAlign: "center",
                      margin: "15px",
                      fontSize: "15px",
                      borderRadius: "9px",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {req.clientName || req.clientKycId}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {req.clientKycId}
                    </div>
                  </Card.Grid>
                );
              })
            : "No pending requests"}
        </Card>

        <Card
          title="Approved Requests"
          style={{ marginBottom: "20px" }}
          hoverable
        >
          {approvedClients.length > 0
            ? approvedClients.map((req, i) => {
                return (
                  <Card.Grid
                    key={i}
                    style={{
                      width: "25%",
                      textAlign: "center",
                      margin: "15px",
                      fontSize: "15px",
                      borderRadius: "9px",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                    onClick={() => {
                      setisLoading(true);
                      fetchClientDataDetails(req.clientKycId).finally(() => {
                        setisLoading(false);
                      });
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {req.clientName || req.clientKycId}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {req.clientKycId}
                    </div>
                  </Card.Grid>
                );
              })
            : "No approved requests"}
        </Card>
        <Card mt={20}></Card>
      </div>
    </>
  );
};

export default Bank;
