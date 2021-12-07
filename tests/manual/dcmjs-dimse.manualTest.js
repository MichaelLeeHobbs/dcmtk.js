const dcmjsDimse = require('dcmjs-dimse');
const { Client } = dcmjsDimse;
const { CStoreRequest } = dcmjsDimse.requests;

const client = new Client();
const request = new CStoreRequest('C:\\Users\\mhobb\\WebstormProjects\\dcmtk.js\\src\\test\\dcmnet\\0091-21122416.dcm');
client.addRequest(request);
client.on('networkError', (e) => {
  console.log('Network error: ', e);
});
client.send('127.0.0.1', 104, 'SCU', 'ANY-SCP');
