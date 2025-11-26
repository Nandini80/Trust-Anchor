import React, { useState, useEffect, useRef } from "react";
import VideoContext from "./VideoContext";
import { io } from "socket.io-client";
import Peer from "simple-peer";

const URL = "http://localhost:5000/";

export const socket = io(URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

const VideoState = ({ children }) => {
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [stream, setStream] = useState();
  const [chat, setChat] = useState([]);
  const [name, setName] = useState("");
  const [call, setCall] = useState({});
  const [me, setMe] = useState("");
  const [userName, setUserName] = useState("");
  const [otherUser, setOtherUser] = useState("");
  const [myVdoStatus, setMyVdoStatus] = useState(true);
  const [userVdoStatus, setUserVdoStatus] = useState();
  const [myMicStatus, setMyMicStatus] = useState(true);
  const [userMicStatus, setUserMicStatus] = useState();
  const [msgRcv, setMsgRcv] = useState("");
  const [isConnecting, setIsConnecting] = useState(true);
  const [socketUpdated, setSocketUpdated] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  // const screenTrackRef = useRef();

  useEffect(() => {
    // Track socket connection status
    // Start with connecting state
    setIsConnecting(true);
    
    // Check initial connection status - if already connected, wait for 'me' event
    if (socket.connected && me) {
      setIsConnecting(false);
    } else if (socket.connected && !me) {
      // Socket is connected but we haven't received 'me' yet
      setIsConnecting(true);
    } else {
      // Socket not connected yet
      setIsConnecting(true);
    }
    
    // Listen for connection events
    socket.on("connect", () => {
      console.log("Socket connected, waiting for 'me' event...");
      // Keep isConnecting true until we receive 'me' event
      setIsConnecting(true);
    });
    
    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnecting(true);
      setSocketUpdated(false);
    });

    socket.on("connect_error", (error) => {
      console.log("Socket connection error:", error);
      setIsConnecting(true);
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if(myVideo.current){
          myVideo.current.srcObject = currentStream;
          myVideo.current.play().catch(err => {
            console.error("Error playing video in VideoState:", err);
          });
        }
      })
      .catch((err) => {
        console.error("Error accessing camera/microphone:", err);
      });
    
    // This is the key event - only set isConnecting to false when we receive socket ID
    let meReceived = false;
    const handleMeEvent = (id) => {
      if (meReceived) return; // Prevent duplicate calls
      meReceived = true;
      console.log("Received socket ID (me event):", id);
      setMe(id);
      setIsConnecting(false); // Only now we know connection is established
    };
    
    socket.on("me", handleMeEvent);
    
    // If socket is already connected when this component mounts, 
    // the 'me' event might have been missed. Use socket.id as fallback.
    let timeoutId = null;
    if (socket.connected && !me) {
      console.log("Socket already connected but no 'me' received, checking socket.id...");
      // Use socket.id directly as fallback if available
      if (socket.id) {
        console.log("Using socket.id as fallback:", socket.id);
        // Small delay to allow 'me' event to arrive first if it's coming
        timeoutId = setTimeout(() => {
          if (!meReceived) {
            console.log("'me' event not received after 1s, using socket.id fallback");
            handleMeEvent(socket.id);
          }
        }, 1000);
      } else {
        console.warn("Socket connected but no ID available yet");
      }
    }

    socket.on("updateUserMedia", ({ type, currentMediaStatus }) => {
      if (currentMediaStatus !== null && currentMediaStatus !== undefined) {
        switch (type) {
          case "video":
            setUserVdoStatus(currentMediaStatus);
            break;
          case "mic":
            setUserMicStatus(currentMediaStatus);
            break;
          default:
            setUserMicStatus(currentMediaStatus[0]);
            setUserVdoStatus(currentMediaStatus[1]);
            break;
        }
      }
    });

    socket.on("callUser", ({ from, name: callerName, signal }) => {
      setCall({ isReceivingCall: true, from, name: callerName, signal });
    });

    socket.on("msgRcv", ({ name, msg: value, sender }) => {
      setMsgRcv({ value, sender });
      setTimeout(() => {
        setMsgRcv({});
      }, 2000);
    });

    // Listen for callAccepted event (when client accepts agent's call)
    socket.on("callAccepted", ({ signal, userName }) => {
      console.log("=== callAccepted event received ===");
      console.log("  - Signal:", signal);
      console.log("  - UserName:", userName);
      console.log("  - Setting callAccepted to TRUE");
      setCallAccepted(true);
      if (userName) {
        setUserName(userName);
      }
      // Signal the peer connection if it exists
      if (connectionRef.current) {
        console.log("  - Signaling peer connection");
        connectionRef.current.signal(signal);
      } else {
        console.warn("  - WARNING: connectionRef.current is null!");
      }
      // Emit media status update - will use current state values
      // Note: myMicStatus and myVdoStatus are from closure, but that's fine for initial status
      socket.emit("updateMyMedia", {
        type: "both",
        currentMediaStatus: [myMicStatus, myVdoStatus],
      });
      console.log("  - callAccepted processing complete");
    });

    // Listen for endCall event (when other party ends the call)
    socket.on("endCall", () => {
      console.log("endCall event received, setting callEnded to true");
      setCallEnded(true);
      if (connectionRef.current) {
        connectionRef.current.destroy();
        connectionRef.current = null;
      }
    });

    // Cleanup function to remove listeners
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      socket.off("me");
      socket.off("updateUserMedia");
      socket.off("callUser");
      socket.off("msgRcv");
      socket.off("callAccepted");
      socket.off("endCall");
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
    };
  }, []);

  // Ensure stream is assigned to myVideo whenever both are available
  useEffect(() => {
    if (stream && myVideo.current) {
      // Assign stream if not already set
      if (!myVideo.current.srcObject) {
        myVideo.current.srcObject = stream;
        myVideo.current.play().catch(err => {
          console.error("Error playing video in VideoState useEffect:", err);
        });
      }
    }
  }, [stream]);


  const answerCall = () => {
    setCallAccepted(true);
    setOtherUser(call.from);
    const peer = new Peer({ initiator: false, trickle: false, stream });

    peer.on("signal", (data) => {
      socket.emit("answerCall", {
        signal: data,
        to: call.from,
        userName: name,
        type: "both",
        myMediaStatus: [myMicStatus, myVdoStatus],
      });
    });

    peer.on("stream", (currentStream) => {
      if(userVideo.current){
        userVideo.current.srcObject = currentStream;
      }
    });

    peer.signal(call.signal);

    connectionRef.current = peer;
    console.log(connectionRef.current);
  };

  const callUser = (id) => {
    // Reset call states when initiating a new call
    setCallEnded(false);
    
    // Set callAccepted to true immediately when call button is clicked
    setCallAccepted(true);
    
    const peer = new Peer({ initiator: true, trickle: false, stream });
    setOtherUser(id);
    
    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
        name,
      });
    });

    peer.on("stream", (currentStream) => {
      console.log("Agent received stream from client");
      if (userVideo.current) {
        userVideo.current.srcObject = currentStream;
      }
    });

    connectionRef.current = peer;
  };

  const updateVideo = () => {
    setMyVdoStatus((currentStatus) => {
      socket.emit("updateMyMedia", {
        type: "video",
        currentMediaStatus: !currentStatus,
      });
      stream.getVideoTracks()[0].enabled = !currentStatus;
      return !currentStatus;
    });
  };

  const updateMic = () => {
    setMyMicStatus((currentStatus) => {
      socket.emit("updateMyMedia", {
        type: "mic",
        currentMediaStatus: !currentStatus,
      });
      stream.getAudioTracks()[0].enabled = !currentStatus;
      return !currentStatus;
    });
  };

  //full screen
  const fullScreen = (e) => {
    const elem = e.target;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      /* Firefox */
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      /* Chrome, Safari & Opera */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      /* IE/Edge */
      elem.msRequestFullscreen();
    }
  };

  const leaveCall = () => {
    setCallEnded(true);

    connectionRef.current.destroy();
    socket.emit("endCall", { id: otherUser });
    // window.location.reload();
  };

  const leaveCall1 = () => {
    socket.emit("endCall", { id: otherUser });
  };
  const sendMsg = (value) => {
    socket.emit("msgUser", { name, to: otherUser, msg: value, sender: name });
    let msg = {};
    msg.msg = value;
    msg.type = "sent";
    msg.timestamp = Date.now();
    msg.sender = name;
    setChat([...chat, msg]);
  };

  return (
    <VideoContext.Provider
      value={{
        call,
        callAccepted,
        myVideo,
        userVideo,
        stream,
        name,
        setName,
        callEnded,
        me,
        callUser,
        leaveCall,
        answerCall,
        sendMsg,
        msgRcv,
        chat,
        setChat,
        setMsgRcv,
        setOtherUser,
        leaveCall1,
        userName,
        myVdoStatus,
        setMyVdoStatus,
        userVdoStatus,
        setUserVdoStatus,
        updateVideo,
        myMicStatus,
        userMicStatus,
        updateMic,
        fullScreen,
        isConnecting,
        socketUpdated,
        setSocketUpdated,
      }}
    >
      {children}
    </VideoContext.Provider>
  );
};

export default VideoState;
