import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { Flex, Box, Card, Heading, Form, Field, Button, Loader, Text } from "rimble-ui";
import InitialiseWeb3 from "../utils/web3.js";
import { baseURL } from "../../api";

const UpdateData = () => {
  const history = useHistory();
  const [dmr, setDmr] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [isLoading, setisLoading] = useState(false);
  const [files, setFiles] = useState({
    panFile: null,
    aadharFile: null
  });
  const [message, setMessage] = useState(null);
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
    setup();
  }, []);

  const setup = async () => {
    let [tempDmr, tempAcc] = await InitialiseWeb3();
    setDmr(tempDmr);
    setAccounts(tempAcc);
  };

  const handelSubmit = async (e) => {
    e.preventDefault();
    
    if (!files.panFile || !files.aadharFile) {
      setMessage("Please upload both PAN and Aadhar documents!");
      return;
    }
    
    setisLoading(true);
    
    try {
      // Upload files to backend first
      const formDataToSend = new FormData();
      formDataToSend.append('panFile', files.panFile);
      formDataToSend.append('aadharFile', files.aadharFile);
      
      const uploadRes = await fetch(`${baseURL}/uploadDocuments`, {
        method: "POST",
        body: formDataToSend,
      });
      
      if (!uploadRes.ok) {
        throw new Error("File upload failed");
      }
      
      const uploadResult = await uploadRes.json();
      const panPath = uploadResult.panPath || `/documents/${files.panFile.name}`;
      const aadharPath = uploadResult.aadharPath || `/documents/${files.aadharFile.name}`;
      
      // Now call blockchain with file paths
      await addCustomer(panPath, aadharPath);
      setMessage("Updated Successfully!");
    } catch (error) {
      console.error(error);
      setMessage("Something went wrong!");
    } finally {
      setisLoading(false);
    }
  };

  const addCustomer = async (panPath, aadharPath) => {
    if (dmr && accounts) {
      return dmr.methods
        .addCustomer(
          formData.name,
          formData.phone,
          formData.address,
          formData.gender,
          formData.dob,
          formData.PANno,
          "p4",
          panPath,
          aadharPath
        )
        .send({ from: accounts[0] })
        .then((res) => {
          console.log(res);
        })
        .catch((err) => {
          console.log(err);
          throw err;
      });
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

  return (
    <>
    <Flex height={"100vh"}>
      <Box mx={"auto"} my={"auto"} width={[1, 9 / 15, 7 / 15]}>
        <Flex px={2} mx={"auto"} justifyContent="space-between">
          <Box my={"auto"}>
            <Heading as={"h2"} color={"primary"}>
              Update Details
            </Heading>
          </Box>
          <Box my={"auto"}>
            <Button
              onClick={() => {
                history.goBack();
              }}
            >
              Back
            </Button>
          </Box>
        </Flex>
        <Form id="update" onSubmit={handelSubmit}>
          <Card mb={20}>
            <Flex mx={-3} flexWrap={"wrap"}>
              <Box width={1} px={3}>
                <Field label="Name" width={1}>
                  <Form.Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) => setformData({ ...formData, name: e.target.value })}
                    required
                    width={1}
                  />
                </Field>
              </Box>
              <Box width={1} px={3}>
                <Field label="E-Mail" width={1}>
                  <Form.Input
                    type="text"
                    name="email"
                    value={formData.email}
                    onChange={(e) => setformData({ ...formData, email: e.target.value })}
                    required
                    width={1}
                  />
                </Field>
              </Box>
              <Box width={1} px={3}>
                <Field label="Address" width={1}>
                  <Form.Input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={(e) =>
                      setformData({ ...formData, address: e.target.value })
                    }
                    required
                    width={1}
                  />
                </Field>
              </Box>
              <Box width={1} px={3}>
                <Field label="Phone No." width={1}>
                  <Form.Input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => setformData({ ...formData, phone: e.target.value })}
                    required
                    width={1}
                  />
                </Field>
              </Box>
              <Flex px={1} mx={"100px"}>
                <Box width={1} px={3}>
                  <Field label="Date of Birth" width={1}>
                    <Form.Input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={(e) => setformData({ ...formData, dob: e.target.value })}
                      required
                      width={1}
                    />
                  </Field>
                </Box>
                <Box width={1} px={3}>
                  <Field label="Gender" width={1}>
                    <Form.Input
                      type="text"
                      name="gender"
                      value={formData.gender}
                      onChange={(e) =>
                        setformData({ ...formData, gender: e.target.value })
                      }
                      required
                      width={1}
                    />
                  </Field>
                </Box>
              </Flex>
              <Box width={1} px={3}>
                <Field label="PAN Number" width={1}>
                  <Form.Input
                    type="text"
                    name="PANno"
                    value={formData.PANno}
                    onChange={(e) => setformData({ ...formData, PANno: e.target.value })}
                    required
                    width={1}
                  />
                </Field>
              </Box>
              <Flex px={1} mx={"100px"}>
                <Box width={1} px={3}>
                  <Field label="PAN Card" width={1}>
                    <Form.Input type="file" required width={1} accept="image/*,.pdf" onChange={(e) => captureFile(e, 'panFile')} />
                  </Field>
                </Box>
                <Box width={1} px={3}>
                  <Field label="Aadhar Card" width={1}>
                    <Form.Input type="file" required width={1} accept="image/*,.pdf" onChange={(e) => captureFile(e, 'aadharFile')} />
                  </Field>
                </Box>
              </Flex>
            </Flex>
          </Card>
          <Flex mx={-3} alignItems={"center"}>
            <Box px={3}>
              <Button type="submit" mt={2} minWidth={"150px"}>
                {isLoading ? <Loader color="white" /> : <p>Update</p>}
              </Button>
            </Box>
            {message && (
              <Box px={3}>
                <Text fontSize={"18px"}>{message}</Text>
              </Box>
            )}
          </Flex>
        </Form>
        <Card mt={20} mb={1}>
          © 2021-2022 Yadav Coin. All Rights Reserved.
        </Card>
      </Box>
    </Flex>
    </>
  );
};

export default UpdateData;
