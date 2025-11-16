import React, {
  useState,
  useContext,
  useEffect,
  useRef
} from "react";
import { Input, Button, Modal } from "antd";
import Phone from "../../../assets/phone.gif";
import Teams from "../../../assets/teams.mp3";
import * as classes from "./Options.module.css";
import VideoContext from "../../../context/VideoContext";
import Hang from "../../../assets/hang.svg";

import {
  UserOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

import { Card } from "antd";

const Options = (props) => {
  console.log(props.clientId);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [remarks, setRemarks] = useState("");
  const Audio = useRef();
  const {
    call,
    callAccepted,
    name,
    callEnded,
    callUser,
    leaveCall,
    answerCall,
    setOtherUser,
    leaveCall1,
    myMicStatus,
    updateMic,
  } = useContext(VideoContext);

  // Show verdict modal when call ends
  useEffect(() => {
    if (callEnded && props.showVerdictModal !== undefined) {
      props.setShowVerdictModal(true);
    }
  }, [callEnded, props]);

  // Handle hang up - trigger call end
  const handleHangUp = () => {
    leaveCall();
    // Give a moment for callEnded to update, then show verdict modal
    setTimeout(() => {
      if (props.imageURL) {
        props.setShowVerdictModal(true);
      }
    }, 500);
  };

  useEffect(() => {
    if (isModalVisible) {
      Audio?.current?.play();
    } else Audio?.current?.pause();
  }, [isModalVisible]);

  const showModal = (showVal) => {
    setIsModalVisible(showVal);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    leaveCall1();
    window.location.reload();
  };

  useEffect(() => {
    if (call.isReceivingCall && !callAccepted) {
      setIsModalVisible(true);
      setOtherUser(call.from);
    } else setIsModalVisible(false);
    // eslint-disable-next-line 
  }, [call.isReceivingCall]);

  return (
    <>
      <div className={classes.options}>
        <div style={{ marginBottom: "0.5rem" }}>
          <h2>Client Info</h2>
          <Input
            size="large"
            prefix={<UserOutlined />}
            maxLength={15}
            suffix={<small>{name.length}/15</small>}
            value="ayush"
            disabled={true}
            className={classes.inputgroup}
          />
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <h2>Call</h2>

          {callAccepted && !callEnded ? (
            <Button
              variant="contained"
              onClick={handleHangUp}
              className={classes.hang}
              tabIndex="0"
            >
              <img src={Hang} alt="hang up" style={{ height: "15px" }} />
              &nbsp; Hang up
            </Button>
            
          ) : (
            <Button
              type="primary"
              icon={<PhoneOutlined />}
              onClick={() => {
                callUser(props.clientId);
                console.log(props.clientId);
              }}
              className={classes.btn}
              tabIndex="0"
            >
              Call
            </Button>
          )}
            <Button onClick={() => {updateMic()}} style={{ marginLeft: "15px" }} ><i
              className={`fa fa-microphone${myMicStatus ? "" : "-slash"}`}
              aria-label={`${myMicStatus ? "mic on" : "mic off"}`}
              aria-hidden="true"
            ></i>
            </Button>
        </div>


        {call.isReceivingCall && !callAccepted && (
          <>
            <audio src={Teams} loop ref={Audio} />
            <Modal
              title="Incoming Call"
              visible={isModalVisible}
              onOk={() => showModal(false)}
              onCancel={handleCancel}
              footer={null}
            >
              <div style={{ display: "flex", justifyContent: "space-around" }}>
                <h1>
                  {call.name} is calling you:{" "}
                  <img
                    src={Phone}
                    alt="phone ringing"
                    className={classes.phone}
                    style={{ display: "inline-block" }}
                  />
                </h1>
              </div>
              <div className={classes.btnDiv}>
                <Button
                  variant="contained"
                  className={classes.answer}
                  color="#29bb89"
                  icon={<PhoneOutlined />}
                  onClick={() => {
                    answerCall();
                    Audio.current.pause();
                  }}
                  tabIndex="0"
                >
                  Answer
                </Button>

                <Button
                  variant="contained"
                  className={classes.decline}
                  icon={<PhoneOutlined />}
                  onClick={() => {
                    setIsModalVisible(false);
                    Audio.current.pause();
                  }}
                  tabIndex="0"
                >
                  Decline
                </Button>
              </div>
            </Modal>
          </>
        )}
      </div>
      <canvas ref={props.canvasEle} style={{ display: "none" }}></canvas>
                  
      {/* KYC Verdict Modal - Shows after call ends */}
      {props.showVerdictModal && callEnded && (
      <Modal
        title="Video KYC Verification - Make Your Decision"
        visible={props.showVerdictModal}
        onCancel={() => {
          props.setShowVerdictModal(false);
        }}
        footer={null}
        width={600}
        closable={true}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          {props.imageURL ? (
            <Card
              style={{ width: "100%", margin: "auto", marginBottom: "20px" }}
              cover={
                <img alt="Client with ID" src={props.imageURL} style={{ maxWidth: "100%" }}/>
              }
            >
              <p style={{ marginTop: "10px", fontWeight: "bold" }}>Screenshot Captured</p>
            </Card>
          ) : (
            <p style={{ color: "#ff4d4f", marginBottom: "20px" }}>
              ⚠️ No screenshot was taken during the call. You can still proceed with the verdict.
            </p>
          )}
        </div>
        
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Remarks (Required):
          </label>
          <Input.TextArea
            rows={4}
            placeholder="Enter your remarks about this KYC verification..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginTop: "20px" }}>
          <Button
            type="primary"
            danger
            size="large"
            onClick={() => {
              if (!remarks.trim()) {
                message.warning("Please enter remarks before rejecting");
                return;
              }
              props.handleVerdict("rejected", remarks);
            }}
            disabled={!remarks.trim()}
          >
            Reject KYC
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={() => {
              if (!remarks.trim()) {
                message.warning("Please enter remarks before accepting");
                return;
              }
              props.handleVerdict("accepted", remarks);
            }}
            disabled={!remarks.trim()}
          >
            Accept KYC
          </Button>
        </div>
      </Modal>)}
    </>
  );
};

export default Options;
