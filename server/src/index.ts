import express from 'express';
import authRouter from './auth';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Enable CORS for development (allowing cookies)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use('/auth', authRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/bol', (req, res) => {
  res.json({
      id: 'BOL-987654321',
      origin: 'Chicago IL',
      destination: 'Dallas TX',
      freight: 'Electronics',
      weight: '4500 lbs'
  });
});

app.post('/api/confirm-bol', (req, res) => {
  const payload = req.body;
  if (!payload || !payload.id || !payload.signature) {
    return res.status(400).json({ error: 'Missing signed payload data' });
  }
  // Process the signed bol logic here...
  res.status(200).json({ success: true, processedAt: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
