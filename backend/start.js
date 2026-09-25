import app from './server.js';

const PORT = process.env.PORT || 4001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Dapoersari Project 2 backend berjalan di http://localhost:${PORT}`
  );
});