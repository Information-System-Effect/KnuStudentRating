const express = require('express');
const app = express();

const PORT = 8081;

app.use(express.text({ type: 'text/plain' }));

app.post('/', (req, res) => {
  const signature = req.get('X-Gateway-Signature');
  const timestamp = req.get('X-Timestamp');

  console.log('\\n✅ [MOCK-BACKEND] Отримано запит від Шлюзу!');
  console.log(`📦 Тіло запиту: ${req.body}`);
  console.log(`🔐 Підпис шлюзу: ${signature ? 'ПРИСУТНІЙ' : 'ВІДСУТНІЙ'}`);
  console.log(`⏱️ Час шлюзу: ${timestamp}`);

  if (!signature) {
    return res.status(401).json({
      ok: false,
      message: 'Несанкціонований доступ: відсутній підпис шлюзу'
    });
  }

  setTimeout(() => {
    res.status(200).json({
      ok: true,
      result: 'updated',
      mockMessage: 'Дані успішно збережено в базі (Імітація)'
    });
  }, 300);
});

app.listen(PORT, () => {
  console.log(`🖥️ Mock-Бекенд запущено на порту ${PORT}`);
});