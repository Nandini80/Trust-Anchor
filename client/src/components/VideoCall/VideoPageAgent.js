import { useEffect, useRef, useState, useContext } from "react";
import Video from "./Video/VideoAgent";
import VideoState, { socket } from "../../context/VideoState";
import VideoContext from "../../context/VideoContext";
import { baseURL } from "../../api";
import Options from "./options/OptionsAgent";
import { ToastContainer, toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import "./VideoPage.css";
// IPFS removed - files are now saved locally in the documents folder

// Component to auto-call the client when agent page loads
const AutoCallClient = ({ clientId, bankName }) => {
  const { callUser, me, callAccepted, callEnded, setName } = useContext(VideoContext);
  const [hasCalled, setHasCalled] = useState(false);

  useEffect(() => {
    // Set bank name for the call
    if (bankName && setName) {
      setName(bankName);
      localStorage.setItem("name", bankName);
    }
  }, [bankName, setName]);

  useEffect(() => {
    // Wait for socket connection and clientId, then auto-call
    if (clientId && me && !hasCalled && !callAccepted && !callEnded) {
      // Small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        console.log("Auto-calling client:", clientId, "as", bankName);
        callUser(clientId);
        setHasCalled(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [clientId, me, callUser, hasCalled, callAccepted, callEnded, bankName]);

  return null;
};

const VideoPage = (props) => {
  const history = useHistory();
  const canvasEle = useRef();
  const imageEle = useRef();
  const [imageURL, setImageURL] = useState();
  const [imageFile, setImageFile] = useState();
  const [SS, setSS] = useState(false);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [clientKycId, setClientKycId] = useState(null);
  const [bankName, setBankName] = useState("Bank");

  useEffect(() => {
    if (!navigator.onLine) toast.error("Please connect to the internet!");
     // eslint-disable-next-line
  }, [navigator]);

  // Get bank name from localStorage or API
  useEffect(() => {
    const token = localStorage.getItem("bankToken");
    if (token) {
      // Try to get from localStorage first
      const bankInfo = localStorage.getItem("bankInfo");
      if (bankInfo) {
        try {
          const parsed = JSON.parse(bankInfo);
          setBankName(parsed.bankName || parsed.email || "Bank");
        } catch (e) {
          console.error("Error parsing bank info:", e);
        }
      }
      
      // Also fetch from API to ensure we have the latest
      fetch(`${baseURL}/bank/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.data.bankName) {
            setBankName(result.data.bankName);
          }
        })
        .catch((err) => {
          console.log("Error fetching bank profile:", err);
        });
    }
  }, []);

  // Get client KYC ID from socket ID
  useEffect(() => {
    const socketId = props.match.params.clientId;
    if (socketId) {
      // Fetch client KYC ID from socket
      fetch(`${baseURL}/getKycIdFromSocket`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ socket: socketId }),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success && result.kycId) {
            setClientKycId(result.kycId);
          }
        })
        .catch((err) => {
          console.log("Error fetching KYC ID:", err);
        });
    }
  }, [props.match.params.clientId]);

  useEffect(() => {
    setImageFile(dataURLtoFile(imageURL, "vidScreenshot"));
  }, [imageURL]);


  const clickScreenshot = async (userVideo) => {
    try {
      if (!userVideo || !userVideo.current) {
        toast.error("Video element not available");
        return;
      }

      const video = userVideo.current;
      
      // Check if video is ready and has valid dimensions
      if (!video.videoWidth || !video.videoHeight || video.videoWidth === 0 || video.videoHeight === 0) {
        toast.warning("Video stream is not ready. Please wait a moment and try again.");
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      
      if (!canvasEle.current) {
        toast.error("Canvas element not available");
        return;
      }

      const ctx = canvasEle.current.getContext("2d");
      canvasEle.current.width = width;
      canvasEle.current.height = height;

      ctx.drawImage(video, 0, 0, width, height);

      let imageDataURL = canvasEle.current.toDataURL("image/png");
      setImageURL(imageDataURL);
      const file = dataURLtoFile(imageDataURL, "userSelfie.png");
      setImageFile(file);
      setSS(true);
      toast.success("Screenshot captured successfully!");
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      toast.error("Failed to capture screenshot. Please try again.");
    }
  };

  const dataURLtoFile = (dataurl, filename) => {
    if (dataurl) {
      var arr = dataurl.split(","),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]),
        n = bstr.length,
        u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    }
  };

  const handleVerdict = async (verdict, remarks = "") => {
    const finalRemarks = remarks.trim() || `KYC ${verdict === "accepted" ? "Accepted" : "Rejected"} via vKYC`;
    
    if (!clientKycId) {
      toast.error("Client information not available");
      return;
    }

    try {
      const token = localStorage.getItem("bankToken");
      if (!token) {
        toast.error("Please login as bank");
        history.push("/bank");
        return;
      }

      // Upload screenshot (if available) and verdict to backend
      const formDataToSend = new FormData();
      if (imageFile) {
        formDataToSend.append('documentFile', imageFile);
      }
      formDataToSend.append('clientKycId', clientKycId);
      formDataToSend.append('verdict', verdict === "accepted" ? "1" : "2");
      formDataToSend.append('remarks', finalRemarks);
      
      const uploadRes = await fetch(`${baseURL}/bank/submit-vkyc-verdict`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });
      
      const uploadResult = await uploadRes.json();
      if (uploadResult.success) {
        toast.success(`KYC ${verdict === "accepted" ? "Accepted" : "Rejected"} successfully!`);
        setShowVerdictModal(false);
        // Redirect to bank dashboard with client KYC ID to show details
        if (clientKycId) {
          history.push(`/bank?kycId=${clientKycId}`);
        } else {
          history.push("/bank");
        }
      } else {
        toast.error(uploadResult.message || "Something went wrong!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong!");
    }
  };



  return (
    <div className="videoPageBody">
      <ToastContainer
        theme="dark"
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <VideoState>
        <AutoCallClient 
          clientId={props.match.params.clientId} 
          bankName={bankName}
        />
        <Video 
          clickScreenshot={clickScreenshot} 
          SS={SS}
          imageURL={imageURL}
          handleVerdict={handleVerdict}
        />
        <Options
          clientId={props.match.params.clientId}
          canvasEle={canvasEle}
          imageEle={imageEle}
          imageURL={imageURL}
          handleVerdict={handleVerdict}
          SS={SS}
          showVerdictModal={showVerdictModal}
          setShowVerdictModal={setShowVerdictModal}
        />
      </VideoState>
    </div>
  );
};

export default VideoPage;
