const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  user: 'postgres',         // <-- ajuste aqui se necessário
  password: 'senai',         // <-- ajuste aqui se necessário
  host: 'localhost',
  port: 5432,
  database: 'saep_db',         // banco exigido pela prova
});

app.use(cors());
app.use(express.json());

// util simples
const ok = (res, data) => res.json(data);
const fail = (res, err, code = 500) => {
  console.error(err);
  res.status(code).json({ error: typeof err === 'string' ? err : 'Erro interno' });
};

// -----------------------------
// HEALTHCHECK
// -----------------------------
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    ok(res, { status: 'ok' });
  } catch (e) { fail(res, e); }
});

// -----------------------------
// USUÁRIOS
// -----------------------------
app.post('/usuarios', async (req, res) => {
  const { nome, email, senha, treinador = false, codigo_funcionario = null } = req.body || {};
  if (!nome || !email || !senha) return fail(res, 'Campos obrigatórios: nome, email, senha', 400);
  
  try {
    const q = `
      INSERT INTO usuarios (usuario_nome, usuario_email, usuario_senha, usuario_treinador, usuario_codigo_funcionario)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING usuario_id, usuario_nome, usuario_email, usuario_treinador, usuario_codigo_funcionario
    `;
    const r = await pool.query(q, [nome, email, senha, Boolean(treinador), codigo_funcionario]);
    ok(res, r.rows[0]);
  } catch (e) {
    if (String(e?.message).includes('unique')) return fail(res, 'E-mail já cadastrado', 409);
    fail(res, e);
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return fail(res, 'Informe email e senha', 400);
  try {
    const r = await pool.query(
      `SELECT usuario_id, usuario_nome, usuario_email, usuario_treinador, usuario_codigo_funcionario 
       FROM usuarios 
       WHERE usuario_email=$1 AND usuario_senha=$2`,
      [email, senha]
    );
    if (r.rows.length === 0) return fail(res, 'Credenciais inválidas', 401);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

// -----------------------------
// MATERIAIS
// -----------------------------

app.get('/materiais', async (req, res) => {
  const q = (req.query.q || '').trim();
  const hasQ = q.length > 0;
  const sql =
    `SELECT material_id, material_nome, material_tipo, material_quantidade
       FROM materiais
     ${hasQ ? 'WHERE lower(material_nome) LIKE lower($1)' : ''}
     ORDER BY material_nome ASC`;
  try {
    const args = hasQ ? [`%${q}%`] : [];
    const r = await pool.query(sql, args);
    ok(res, r.rows);
  } catch (e) { fail(res, e); }
});

app.get('/materiais/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT material_id, material_nome, material_tipo, material_quantidade
         FROM materiais WHERE material_id=$1`,
      [req.params.id]
    );
    if (!r.rows.length) return fail(res, 'Material não encontrado', 404);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.post('/materiais', async (req, res) => {
  const { nome, tipo, quantidade = 0 } = req.body || {};
  if (!nome) return fail(res, 'Campo obrigatório: nome', 400);
  try {
    const r = await pool.query(
      `INSERT INTO materiais (material_nome, material_tipo, material_quantidade)
       VALUES ($1, $2, $3)
       RETURNING material_id, material_nome, material_tipo, material_quantidade`,
      [nome, tipo || null, Number(quantidade) || 0]
    );
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.put('/materiais/:id', async (req, res) => {
  const { nome, tipo, quantidade } = req.body || {};
  try {
    const r = await pool.query(
      `UPDATE materiais
         SET material_nome = COALESCE($1, material_nome),
             material_tipo = COALESCE($2, material_tipo),
             material_quantidade = COALESCE($3, material_quantidade)
       WHERE material_id=$4
       RETURNING material_id, material_nome, material_tipo, material_quantidade`,
      [nome ?? null, tipo ?? null, quantidade ?? null, req.params.id]
    );
    if (!r.rows.length) return fail(res, 'Material não encontrado', 404);
    ok(res, r.rows[0]);
  } catch (e) { fail(res, e); }
});

app.delete('/materiais/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM materiais WHERE material_id=$1 RETURNING material_id', [req.params.id]);
    if (!r.rows.length) return fail(res, 'Material não encontrado', 404);
    ok(res, { message: 'Material excluído' });
  } catch (e) { fail(res, e); }
});

app.post('/movimentoestoque', async (req, res) => {
  const { material_id, usuario_id, data_esprestimo } = req.body || {};
  if (!material_id || !usuario_id)
    return fail(res, 'Campos obrigatórios: material_id, usuario_id', 400);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const up = await client.query(
      `UPDATE materiais 
       SET material_quantidade = material_quantidade - 1 
       WHERE material_id=$1 AND material_quantidade > 0 
       RETURNING *`,
      [material_id]
    );
    
    if (!up.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      return fail(res, 'Material não encontrado ou sem estoque', 404);
    }

    const ins = await client.query(
      `INSERT INTO movimentoestoque (material_id, usuario_id, material_disponivel, material_data_esprestimo, material_data_devolucao)
       VALUES ($1, $2, FALSE, COALESCE($3, NOW()), NULL)
       RETURNING *`, 
      [material_id, usuario_id, data_esprestimo || null]
    );

    await client.query('COMMIT');
    client.release();

    ok(res, {
      movimento: ins.rows[0],
      material: up.rows[0], 
    });
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    client.release();
    fail(res, e);
  }
});

app.put('/movimentoestoque/:id/devolver', async (req, res) => {
  const { id: movimentoestoque_id } = req.params;
  const { data_devolucao } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const mov = await client.query(
      `UPDATE movimentoestoque
       SET material_disponivel = TRUE, 
           material_data_devolucao = COALESCE($1, NOW())
       WHERE movimentoestoque_id = $2 AND material_data_devolucao IS NULL
       RETURNING *`, // Retorna o movimento atualizado
      [data_devolucao || null, movimentoestoque_id]
    );

    if (!mov.rows.length) {
      await client.query('ROLLBACK');
      client.release();
      return fail(res, 'Empréstimo não encontrado ou já devolvido', 404);
    }
    
    const movimentoAtualizado = mov.rows[0];
    
    const up = await client.query(
      `UPDATE materiais
       SET material_quantidade = material_quantidade + 1
       WHERE material_id = $1
       RETURNING *`, 
      [movimentoAtualizado.material_id]
    );

    await client.query('COMMIT');
    client.release();

    ok(res, {
      movimento: movimentoAtualizado,
      material: up.rows[0],
    });

  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    client.release();
    fail(res, e);
  }
});



app.get('/movimentoestoque', async (req, res) => {
  const { material_id } = req.query;
  const hasFilter = !!material_id;
  
  const sql = `
    SELECT m.movimentoestoque_id, 
           m.material_id, p.material_nome,
           m.usuario_id, u.usuario_nome,
           m.material_disponivel, m.material_data_esprestimo, m.material_data_devolucao
      FROM movimentoestoque m
      JOIN materiais p ON p.material_id = m.material_id
      JOIN usuarios u ON u.usuario_id = m.usuario_id
     ${hasFilter ? 'WHERE m.material_id = $1' : ''}
     ORDER BY m.material_data_esprestimo DESC, m.movimentoestoque_id DESC
  `;
  try {
    const r = await pool.query(sql, hasFilter ? [material_id] : []);
    ok(res, r.rows);
  } catch (e) { fail(res, e); }
});

// -----------------------------
// START
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));