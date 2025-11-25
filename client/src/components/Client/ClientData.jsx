import React, { useState,useEffect } from "react";
import { Image, Row, Col, message, Card, Typography, Descriptions, Button, Modal, Table } from 'antd';
import {CopyTwoTone} from '@ant-design/icons';
import { baseURL } from "../../api";

const findStatus = (stCode)=>{
  if(stCode==="0"){
    return "Not initiated"
  }else if(stCode==="1"){
    return "Accepted"
  }else if(stCode==="2"){
    return "Rejected"
  }else if(stCode==="3"){
    return "Re KYC needed"
  }
}

const ClientData = ({ userData }) => {
  const [isModal, setisModal] = useState();
  const [tableData, settableData] = useState([]);
  const [kycStat, setkysStat] = useState("");
  const { Text} = Typography;

  useEffect(() => {
    if(userData){
    let da = []
    setkysStat(findStatus(userData.kycStatus))
    // Handle kycHistory - it might be empty or undefined
    if (userData.kycHistory && Array.isArray(userData.kycHistory) && userData.kycHistory.length > 0) {
      userData.kycHistory.forEach(item => {
        var d = new Date(parseInt(item[3])); 
        // Format date and time: "MM/DD/YYYY HH:MM:SS"
        const formattedDateTime = d.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        const Titem = {
          name: item[0],
          remarks: item[1],
          status: findStatus(item[2]),
          time: formattedDateTime
        }
        da.push(Titem)
      });
    }
    settableData(da)
    }
     // eslint-disable-next-line 
  }, [userData]);
  

  const copyKycId = (id)=>{
    navigator.clipboard.writeText(`${id}`)
    message.success("KYC ID Copied!")
  }

  const toggleModal = ()=>{
    setisModal((prev)=>{
      return !prev
    })
  }

  const columns = [
  {
    title: 'Bank Name',
    dataIndex: 'name',
    key: 'name',
    render: text => <span style={{color:"#1890ff"}}>{text}</span>,
  },
  {
    title: 'Remarks',
    dataIndex: 'remarks',
    key: 'remarks',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
  },
  {
    title: 'Date & Time',
    dataIndex: 'time',
    key: 'time',
    render: (text) => <span style={{fontWeight: '500'}}>{text}</span>,
  },
]

  
  
  return (
    <>
    
    <Modal title="KYC History" visible={isModal} onOk={toggleModal} onCancel={toggleModal}>
      {tableData.length>0 ? <Table columns={columns} dataSource={tableData} />:
      "No records found"}
      </Modal>
      <div className="site-card-wrapper">
        <Row gutter={16}>
          <Col span={8}>
            <Row span={6}>
              <Card title="Profile Picture" bordered={false}>
                <Image width={300}
                  alt="Loading....."
                  src={userData.records[2] && userData.records[2][1] 
                    ? (userData.records[2][1].startsWith('http') 
                        ? userData.records[2][1] 
                        : `${baseURL}${userData.records[2][1]}`)
                    : ''}
                />
              </Card>
            </Row>
            <Row span={2}>
              <Card>        
                <Row> 
                  <h1> KYC ID : <Text type={kycStat==="Accepted" ? "success" : "danger"}>{userData.kycId}</Text></h1>   
                  <CopyTwoTone style={{ fontSize: '150%'}} onClick={() => copyKycId(userData.kycId) }/>                                      
                </Row>                        
              </Card>         
            </Row>
          </Col>
          <Col span={8}>
            <Card title="Basic Details" bordered={true}>
              <Descriptions title="User Info" layout="horizontal">
                <Descriptions.Item label="Name " span={3}>{userData.name}</Descriptions.Item>
                <Descriptions.Item label="Gender " span={3}>{userData.gender}</Descriptions.Item>
                <Descriptions.Item label="Phone " span={3}>{userData.phone}</Descriptions.Item>
                <Descriptions.Item label="Address " span={3}>{userData.address}</Descriptions.Item>
                <Descriptions.Item label="Email " span={3}>{userData.email}</Descriptions.Item>
                <Descriptions.Item label="KYC Id " span={3}>{userData.kycId}</Descriptions.Item>
                <Descriptions.Item label="KYC Status "><strong>{kycStat}</strong></Descriptions.Item>
              </Descriptions>
              <Button onClick={toggleModal}>Show KYC History</Button>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Documents" bordered={false}>
              <Image.PreviewGroup>
                <Image 
                  width={300} 
                  src={userData.records[0] && userData.records[0][1]
                    ? (userData.records[0][1].startsWith('http') 
                        ? userData.records[0][1] 
                        : `${baseURL}${userData.records[0][1]}`)
                    : ''} 
                />
                <Image
                  width={300}
                  src={userData.records[1] && userData.records[1][1]
                    ? (userData.records[1][1].startsWith('http') 
                        ? userData.records[1][1] 
                        : `${baseURL}${userData.records[1][1]}`)
                    : ''}
                />
              </Image.PreviewGroup>
            </Card>
          </Col>
        </Row>
      </div>

    </>
  );
};

export default ClientData;