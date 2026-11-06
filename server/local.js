// Servidor local para desenvolvimento: node server/local.js
const app = require('./app');
const porta = process.env.PORT || 3001;
app.listen(porta, () => console.log(`API NexusGov em http://localhost:${porta}`));
