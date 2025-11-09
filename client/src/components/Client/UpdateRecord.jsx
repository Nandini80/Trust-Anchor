import React, { useState } from "react";
import { useHistory } from "react-router-dom";
import { baseURL } from "../../api";
import { Select, Space, Card, Row, Button, message  } from "antd";

const UpdateRecord = () => {
  const history = useHistory();
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState("");
  const [isLoading, setisLoading] = useState(false);
  const { Option } = Select;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      message.error("Please select a file to upload");
      return;
    }
    
    if (!docType) {
      message.error("Please select a document type");
      return;
    }
    
    setisLoading(true);
    
    // Create FormData to send file
    const formDataToSend = new FormData();
    formDataToSend.append('documentFile', selectedFile);
    formDataToSend.append('record_type', docType);
    
    try {
      const res = await fetch(`${baseURL}/updateRecord`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        },
        body: formDataToSend,
      });
      
      const result = await res.json();
      setisLoading(false);
      
      if (result.success) {
        message.success("Updated Successfully!");
        setSelectedFile(null);
        setDocType("");
      } else {
        message.error(result.message || "Something went wrong");
      }
    } catch (err) {
      setisLoading(false);
      message.error("Something went wrong!");
      console.log(err);
    }
  };

  const handleChange = (e) => {
    console.log(e);
    setDocType(e);
  };

  const captureFile = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <>
      <div style={{ margin: "20px" }}>
        <div
          style={{
            padding: "30px",
            width: "800px",
            margin: "0 auto",
            paddingBottom: "60px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "end",
              marginBottom: "20px",
            }}
          >
            <Button
              type="primary"
              size={"large"}
              onClick={() => {
                history.goBack();
              }}
            >
              Back
            </Button>
          </div>

          <Card title="Update Document" bordered={true}>
            <Row justify="center">
              <Space>
                <Select
                  size={"large"}
                  defaultValue="Select"
                  style={{ width: 120 }}
                  onChange={handleChange}
                >
                  <Option value="aadhar">Aadhar</Option>
                  <Option value="pan">Pan</Option>
                </Select>
                <input onChange={captureFile} type="file" accept="image/*,.pdf" />{" "}
                <Button type="primary" size={"large"} loading={isLoading} onClick={handleSubmit}>
                  Submit
                </Button>
              </Space>
            </Row>
          </Card>
        </div>
      </div>
    </>
  );
};

export default UpdateRecord;
