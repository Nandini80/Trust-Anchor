import { useEffect, useRef, useState } from "react";
import Video from "./Video/VideoAgent";
import VideoState from "../../context/VideoState";
import { baseURL } from "../../api";
import Options from "./options/OptionsAgent";
import { ToastContainer, toast } from "react-toastify";
import { useHistory } from "react-router-dom";
import "./VideoPage.css";
// IPFS removed - files are now saved locally in the documents folder

const VideoPage = (props) => {
  const history = useHistory();
  const canvasEle = useRef();
  const imageEle = useRef();
  const [imageURL, setImageURL] = useState();
  const [imageFile, setImageFile] = useState();
  const [SS, setSS] = useState(false);
  const [showVerdictModal, setShowVerdictModal] = useState(false);
  const [clientKycId, setClientKycId] = useState(null);

  useEffect(() => {
    if (!navigator.onLine) toast.error("Please connect to the internet!");
     // eslint-disable-next-line
  }, [navigator]);

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
    const width = userVideo.current.videoWidth;
    const height = userVideo.current.videoHeight;
    const ctx = canvasEle.current.getContext("2d");
    canvasEle.current.width = width;
    canvasEle.current.height = height;

    ctx.drawImage(userVideo.current, 0, 0, width, height);

    let imageDataURL = canvasEle.current.toDataURL("image/png");
    setImageURL(imageDataURL);
    const file = dataURLtoFile(imageDataURL, "userSelfie.png");
    setImageFile(file);
    setSS(true);
    toast.success("Screenshot captured successfully!");
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

  const handleVerdict = async (verdict, remarks) => {
    if (!remarks || !remarks.trim()) {
      toast.warning("Please enter remarks before submitting verdict");
      return;
    }
    
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
      formDataToSend.append('remarks', remarks);
      
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
        // Redirect back to bank dashboard
        setTimeout(() => {
          history.push("/bank");
        }, 1500);
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
        <Video 
          clickScreenshot={clickScreenshot} 
          SS={SS}
          imageURL={imageURL}
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
