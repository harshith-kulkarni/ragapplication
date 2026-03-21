const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const FormData = require('form-data');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/build'))); // Serve React build

const upload = multer({ storage: multer.memoryStorage() });

// Proxy to Python API
const pythonAPI = 'http://localhost:8000';

function handleError(error, res) {
  const status = error.response?.status || 500;
  const detail = error.response?.data?.detail || error.message;
  console.error('Proxy error:', detail);
  res.status(status).json({ error: detail });
}

// Routes
app.post('/api/process_topic', async (req, res) => {
  try {
    const response = await axios.post(`${pythonAPI}/process_topic`, req.body);
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

app.post('/api/process_url', async (req, res) => {
  try {
    const response = await axios.post(`${pythonAPI}/process_url`, req.body);
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

app.post('/api/process_pdf', upload.single('file'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, { filename: req.file.originalname });
    const response = await axios.post(`${pythonAPI}/process_pdf`, form, {
      headers: form.getHeaders()
    });
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const response = await axios.post(`${pythonAPI}/chat`, req.body);
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
});

// Serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
