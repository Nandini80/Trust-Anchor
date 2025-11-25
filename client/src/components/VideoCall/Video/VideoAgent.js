import React, { useContext, useEffect, useState, useRef } from "react";
import VideoContext from "../../../context/VideoContext";
import "./Video.css";
import {  Modal, Input, notification } from "antd";
import ScreenShotIcon from "../../../assets/screenshot.png";
import Msg_Illus from "../../../assets/msg_illus.svg";
import Msg from "../../../assets/msg.svg";
import { MessageOutlined } from "@ant-design/icons";

import { socket } from "../../../context/VideoState";

// const socket = io()
const { Search } = Input;
const Video = (props) => {
  const {
    callAccepted,
    myVideo,
    userVideo,
    stream,
    name,
    callEnded,
    sendMsg: sendMsgFunc,
    msgRcv,
    chat,
    setChat,
    fullScreen,
    myVdoStatus,
    userVdoStatus,
  } = useContext(VideoContext);

  const [sendMsg, setSendMsg] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Ensure bank's video stream is assigned and playing - hard input
  useEffect(() => {
    const assignStream = () => {
      if (stream && myVideo.current) {
        console.log("Assigning stream to myVideo", stream);
        // Always update srcObject when stream changes
        myVideo.current.srcObject = stream;
        // Ensure video plays immediately
        myVideo.current.play()
          .then(() => {
            console.log("Bank video playing successfully");
          })
          .catch(err => {
            console.error("Error playing bank video:", err);
          });
      }
    };

    // Try immediately
    assignStream();

    // Also try after a short delay in case element isn't ready
    const timeout = setTimeout(assignStream, 100);
    
    return () => clearTimeout(timeout);
  }, [stream]);

  // Callback to set stream when video ref is ready
  const setVideoRef = (videoElement) => {
    if (videoElement && stream) {
      console.log("Setting video ref with stream", stream);
      videoElement.srcObject = stream;
      videoElement.play()
        .then(() => {
          console.log("Video playing after ref set");
        })
        .catch(err => {
          console.error("Error playing bank video on ref set:", err);
        });
    }
  };

  // Debug: Log when userVideo stream changes
  useEffect(() => {
    if (userVideo.current && userVideo.current.srcObject) {
      console.log("Client video stream detected in VideoAgent:", userVideo.current.srcObject);
      // Ensure video plays
      userVideo.current.play().catch(err => {
        console.error("Error playing video:", err);
      });
    }
  }, [callAccepted, userVideo]);

  socket.on("msgRcv", ({ name, msg: value, sender }) => {
    let msg = {};
    msg.msg = value;
    msg.type = "rcv";
    msg.sender = sender;
    msg.timestamp = Date.now();
    setChat([...chat, msg]);
  });

  const dummy = useRef();

  useEffect(() => {
    if (dummy?.current) dummy.current.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const onSearch = (value) => {
    if (value && value.length) sendMsgFunc(value);
    setSendMsg("");
  };

  useEffect(() => {
    if (msgRcv.value && !isModalVisible) {
      notification.open({
        message: "",
        description: `${msgRcv.sender}: ${msgRcv.value}`,
        icon: <MessageOutlined style={{ color: "#108ee9" }} />,
      });
    }
    // eslint-disable-next-line
  }, [msgRcv]);

  return (
    <>
      <div className="grid">
        {/* Bank's video - always shown, even before stream is ready */}
        <div
          style={{ textAlign: "center" }}
          className="card"
          id={callAccepted && !callEnded ? "video1" : "video3"}
        >
          <div style={{ height: "2rem" }}>
            <h3>{callAccepted && !callEnded ? "Video Call Active" : "Waiting for client..."}</h3>
          </div>
          <div className="video-avatar-container">
            {/* Bank's own video - ALWAYS shown as hard input - displays immediately */}
            <video
                playsInline
                onClick={fullScreen}
                ref={(el) => {
                  if (el) {
                    myVideo.current = el;
                    console.log("Video element ref set", el);
                    // Immediately assign stream if available
                    if (stream && !el.srcObject) {
                      console.log("Assigning stream in ref callback", stream);
                      el.srcObject = stream;
                      el.play()
                        .then(() => {
                          console.log("Video playing from ref callback");
                        })
                        .catch(err => {
                          console.error("Error playing video from ref callback:", err);
                        });
                    }
                  }
                }}
                autoPlay
                muted
                className="video-active"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  position: callAccepted && !callEnded ? "absolute" : "relative",
                  top: 0,
                  left: 0,
                  zIndex: callAccepted && !callEnded ? 1 : 2,
                  opacity: myVdoStatus !== false ? "1" : "0.7",
                  backgroundColor: "#000",
                  display: "block",
                  minHeight: "300px"
                }}
                onLoadedMetadata={() => {
                  console.log("Video metadata loaded");
                  if (myVideo.current) {
                    myVideo.current.play().catch(err => {
                      console.error("Error auto-playing bank video:", err);
                    });
                  }
                }}
                onCanPlay={() => {
                  console.log("Video can play");
                  if (myVideo.current) {
                    myVideo.current.play().catch(err => {
                      console.error("Error playing bank video on canPlay:", err);
                    });
                  }
                }}
                onPlay={() => {
                  console.log("Video is playing!");
                }}
              />
              
              {/* Client's video - shown when call is accepted, overlays bank video */}
              {callAccepted && !callEnded && (
                <video
                  playsInline
                  onClick={fullScreen}
                  ref={userVideo}
                  autoPlay
                  muted={false}
                  className="video-active"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 3,
                    opacity: `${userVdoStatus !== false ? "1" : "0"}`,
                    backgroundColor: "#000"
                  }}
                  onLoadedMetadata={() => {
                    if (userVideo.current) {
                      userVideo.current.play().catch(err => {
                        console.error("Error auto-playing client video:", err);
                      });
                    }
                  }}
                />
              )}
              
              {/* Hidden client video element while waiting */}
              {!callAccepted && (
                <video
                  playsInline
                  ref={userVideo}
                  autoPlay
                  muted={false}
                  className="video-active"
                  style={{
                    display: "none"
                  }}
                />
              )}
            </div>

            <div className="iconsDiv">
              {callAccepted && !callEnded && (
                <div
                  className="icons"
                  onClick={() => {
                    setIsModalVisible(!isModalVisible);
                  }}
                  tabIndex="0"
                >
                  <img src={Msg} alt="chat icon" />
                </div>
              )}

              {callAccepted && !callEnded && (
                <div
                  className="icons"
                  onClick={() => {
                    // Capture client video
                    if (userVideo?.current && userVideo.current.videoWidth > 0) {
                      props.clickScreenshot(userVideo);
                    } else {
                      notification.warning({
                        message: "Screenshot Unavailable",
                        description: "Video stream is not ready. Please wait a moment and try again.",
                      });
                    }
                  }}
                  tabIndex="0"
                >
                  <img src={ScreenShotIcon} alt="screenshot icon" />
                </div>
              )}
            </div>

            {/* Accept/Reject KYC Buttons at Bottom - Only show when call is accepted */}
            {callAccepted && !callEnded && (
              <div style={{ 
                marginTop: "20px", 
                padding: "20px",
                display: "flex", 
                justifyContent: "center", 
                gap: "20px",
                borderTop: "2px solid #e8e8e8",
                backgroundColor: "#fafafa"
              }}>
                <button
                  onClick={() => {
                    if (props.handleVerdict) {
                      props.handleVerdict("accepted", "");
                    }
                  }}
                  style={{
                    padding: "12px 30px",
                    backgroundColor: "#52c41a",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#73d13d";
                    e.target.style.transform = "scale(1.05)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#52c41a";
                    e.target.style.transform = "scale(1)";
                  }}
                >
                  Accept KYC
                </button>

                <button
                  onClick={() => {
                    if (props.handleVerdict) {
                      props.handleVerdict("rejected", "");
                    }
                  }}
                  style={{
                    padding: "12px 30px",
                    backgroundColor: "#ff4d4f",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = "#ff7875";
                    e.target.style.transform = "scale(1.05)";
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = "#ff4d4f";
                    e.target.style.transform = "scale(1)";
                  }}
                >
                  Reject KYC
                </button>
              </div>
            )}
          </div>

        {/* Chat Modal */}
        <Modal
          title="Chat"
          footer={null}
          visible={isModalVisible}
          onOk={() => setIsModalVisible(false)}
          onCancel={() => setIsModalVisible(false)}
          style={{ maxHeight: "100px" }}
        >
          {chat.length ? (
            <div className="msg_flex">
              {chat.map((msg, idx) => (
                <div key={idx} className={msg.type === "sent" ? "msg_sent" : "msg_rcv"}>
                  {msg.msg}
                </div>
              ))}
              <div ref={dummy} id="no_border"></div>
            </div>
          ) : (
            <div className="chat_img_div">
              <img src={Msg_Illus} alt="msg_illus" className="img_illus" />
            </div>
          )}
          <Search
            placeholder="your message"
            allowClear
            className="input_msg"
            enterButton="Send 🚀"
            onChange={(e) => setSendMsg(e.target.value)}
            value={sendMsg}
            size="large"
            onSearch={onSearch}
          />
        </Modal>
      </div>
    </>
  );
};

export default Video;
