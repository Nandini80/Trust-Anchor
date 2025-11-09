import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
  Button,
  Form,
  Input,
  DatePicker,
  Select,
  Row,
  Card,
  Space,
  Modal,
  message,
} from "antd";
import { UploadOutlined, CameraTwoTone } from "@ant-design/icons";
import { baseURL } from "../../api";
import Webcam from "react-webcam";

// IPFS removed - files are now saved locally in the documents folder

const NewClient = () => {
  const history = useHistory();
  const [isLoading, setisLoading] = useState(false);
  const [files, setFiles] = useState({
    panFile: null,
    aadharFile: null,
    selfieFile: null
  });
  const [geo, setGeo] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const webcamRef = useRef(null);

  const [formData, setformData] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
    dob: "",
    gender: "",
    PANno: "",
  });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(function (position) {
      setGeo(position.coords.latitude + "," + position.coords.longitude);
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that all files are selected
    if (!files.panFile || !files.aadharFile || !files.selfieFile) {
      message.error("Please upload all required documents (PAN, Aadhar, and Selfie)");
      return;
    }
    
    setisLoading(true);
    
    // Debug: Log form data before sending
    console.log("Form data to send:", formData);
    console.log("Files to send:", {
      panFile: files.panFile?.name || 'Not selected',
      aadharFile: files.aadharFile?.name || 'Not selected',
      selfieFile: files.selfieFile?.name || 'Not selected'
    });
    console.log("Geo location:", geo);
    
    // Create FormData to send files
    const formDataToSend = new FormData();
    formDataToSend.append('panFile', files.panFile);
    formDataToSend.append('aadharFile', files.aadharFile);
    formDataToSend.append('selfieFile', files.selfieFile);
    formDataToSend.append('formData', JSON.stringify({ ...formData, geo }));
    formDataToSend.append('sender', 'client');
    
    // Debug: Log FormData contents (FormData doesn't show contents in console.log)
    console.log("FormData created. Entries:");
    for (let pair of formDataToSend.entries()) {
      if (pair[0] === 'formData') {
        console.log(`  ${pair[0]}:`, pair[1]); // This will show the JSON string
      } else {
        console.log(`  ${pair[0]}:`, pair[1]?.name || pair[1] || 'No file');
      }
    }
    
    try {
      const res = await fetch(`${baseURL}/register`, {
        method: "POST",
        body: formDataToSend,
      });
      
      let result;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await res.json();
      } else {
        // If response is not JSON, read as text
        const text = await res.text();
        result = {
          success: false,
          message: text || `Server error (${res.status})`,
          error: { message: text || `Server error (${res.status})` }
        };
      }
      
      setisLoading(false);
      
      if (result.success) {
        message.success("Registered Successfully!");
      } else {
        message.error(result.message || result.error?.message || "Something went wrong");
        console.error("Registration error:", result);
      }
    } catch (err) {
      setisLoading(false);
      message.error("Network error! Please check your connection.");
      console.error("Registration error:", err);
    }
  };

  const captureFile = (e, fileType) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({
        ...prev,
        [fileType]: file
      }));
    }
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    capture();
    message.success("Selfie clicked!!");
    setIsModalVisible(false);
  };

  function dataURLtoFile(dataurl, filename) {
    var arr = dataurl.split(","),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    // Ensure filename has correct extension based on mime type
    let finalFilename = filename;
    if (mime === 'image/png' && !filename.endsWith('.png')) {
      finalFilename = filename.replace(/\.[^/.]+$/, '') + '.png';
    } else if (mime === 'image/jpeg' && !filename.endsWith('.jpg') && !filename.endsWith('.jpeg')) {
      finalFilename = filename.replace(/\.[^/.]+$/, '') + '.jpg';
    }
    return new File([u8arr], finalFilename, { type: mime });
  }

  const capture = React.useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    var file = dataURLtoFile(imageSrc, "selfie.png");
    setFiles(prev => ({
      ...prev,
      selfieFile: file
    }));
     // eslint-disable-next-line 
  }, [webcamRef]);

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <Modal
        title="Basic Modal"
        visible={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Card>
          <Webcam style={{ width: "100%" }} ref={webcamRef} />
        </Card>
      </Modal>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          margin: "0 auto",
          width: "80%",
          textAlign: "center",
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
            <h1 style={{ color: "rgb(14 21 246 / 85%)" }}>vKYC</h1>
          </div>
          <div style={{ margin: "auto 0" }}>
            <Button
              type="primary"
              onClick={() => {
                history.goBack();
              }}
            >
              Back
            </Button>
          </div>
        </div>
        <Card style={{ width: "50%", margin: "0 auto" }} hoverable>
          <Form layout="horizontal" style={{ margin: "10px" }} size={"large"}>
            <Form.Item label="Full Name">
              <Input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setformData({ ...formData, name: e.target.value })
                }
                required
              />
            </Form.Item>
            <Form.Item label="Email Id">
              <Input
                type="email Id"
                value={formData.email}
                onChange={(e) =>
                  setformData({ ...formData, email: e.target.value })
                }
                required
              />
            </Form.Item>
            <Form.Item label="Address">
              <Input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setformData({ ...formData, address: e.target.value })
                }
                required
              />
            </Form.Item>

            <Form.Item label="Phone No">
              <Input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setformData({ ...formData, phone: e.target.value })
                }
                required
              />
            </Form.Item>
            <Space>
              <Form.Item
                label="DOB"
                style={{
                  display: "inline-block",
                }}
              >
                <DatePicker
                  style={{ width: 120 }}
                  onChange={(date, dateString) => {
                    setformData({ ...formData, dob: dateString });
                  }}
                />
              </Form.Item>
              <Form.Item
                label="Gender"
                style={{
                  display: "inline-block",
                }}
              >
                <Select
                  size={"large"}
                  style={{ width: 120 }}
                  defaultValue="Select"
                  onChange={(e) => setformData({ ...formData, gender: e })}
                >
                  <Select.Option value="Male">Male</Select.Option>
                  <Select.Option value="Female">Female</Select.Option>
                  <Select.Option value="Other">Other</Select.Option>
                </Select>
              </Form.Item>
            </Space>
            <Row>
              <Form.Item label="PAN Number" style={{ width: "45%" }}>
                <Input
                  type="text"
                  value={formData.PANno}
                  onChange={(e) =>
                    setformData({ ...formData, PANno: e.target.value })
                  }
                  required
                />
              </Form.Item>

              <Form.Item
                label="PAN Card"
                style={{ width: "50%", marginLeft: "30px" }}
              >
                <Input
                  type="file"
                  suffix={<UploadOutlined />}
                  required
                  accept="image/*,.pdf"
                  onChange={(e) => captureFile(e, 'panFile')}
                />
              </Form.Item>
            </Row>
            <Row>
              <Form.Item label="Aadhar Card" style={{ width: "45%" }}>
                <Input
                  type="file"
                  suffix={<UploadOutlined />}
                  required
                  accept="image/*,.pdf"
                  onChange={(e) => captureFile(e, 'aadharFile')}
                />
              </Form.Item>
              <Button
                size="large"
                label="Selfie Photo"
                style={{ width: "31%", marginLeft: "80px" }}
                onClick={showModal}
              >
                <CameraTwoTone />
                Click a Selfie
              </Button>
            </Row>

            <Button
              size="large"
              type="submit"
              onClick={handleSubmit}
              loading={isLoading}
            >
              Register
            </Button>
          </Form>
        </Card>
      </div>
    </>
  );
};

export default NewClient;
