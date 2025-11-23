import React, { useContext, useEffect, useState, useRef } from "react";
import VideoContext from "../../../context/VideoContext";
import "./Video.css";
import {  Modal, Input, notification, Avatar } from "antd";
import ScreenShotIcon from "../../../assets/screenshot.png";
import Msg_Illus from "../../../assets/msg_illus.svg";
import Msg from "../../../assets/msg.svg";
import { UserOutlined, MessageOutlined, RedoOutlined } from "@ant-design/icons";

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
    userVdoStatus,
    myVdoStatus,
  } = useContext(VideoContext);

  const [sendMsg, setSendMsg] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
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

  const showModal = (showVal) => {
    setIsModalVisible(showVal);
  };

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
        {/* Bank's own video - shown as "Client Video" */}
        {stream ? (
          <div
            style={{ textAlign: "center" }}
            className="card"
            id="video1"
          >
            <div style={{ height: "2rem" }}>
              <h3>Client Video</h3>
            </div>
            <div className="video-avatar-container">
              <video
                playsInline
                muted
                onClick={fullScreen}
                ref={myVideo}
                autoPlay
                className="video-active"
                style={{
                  opacity: `${myVdoStatus ? "1" : "0"}`,
                }}
              />

              <Avatar
                style={{
                  backgroundColor: "#116",
                  position: "absolute",
                  opacity: `${myVdoStatus ? "-1" : "2"}`,
                }}
                size={98}
                icon={<UserOutlined />}
              >
                {name || "Client"}
              </Avatar>
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
                  onClick={() => props.clickScreenshot(myVideo)}
                  tabIndex="0"
                >
                  <img src={ScreenShotIcon} alt="screenshot icon" />
                </div>
              )}
            </div>

            {/* Accept/Reject KYC Buttons at Bottom */}
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
                    props.handleVerdict("accepted");
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
                    props.handleVerdict("rejected");
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
          </div>
        ) : (
          <div className="bouncing-loader">
            <div></div>
            <div></div>
            <div></div>
          </div>
        )}

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
