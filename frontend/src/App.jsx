import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 8000,
});

// util
const notEmpty = (v) => String(v ?? "").trim().length > 0;
const toInt = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

export default function App() {
  const [view, setView] = useState("login"); // 'login' | 'home' | 'materiais' | 'estoque'
  const [user, setUser] = useState(null); // {id, nome, email}

  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const doLogin = async (e) => {
    e?.preventDefault();
    if (!notEmpty(loginEmail) || !notEmpty(loginSenha)) {
      alert("Informe email e senha.");
      return;
    }
    try {
      const { data } = await API.post("/auth/login", {
        email: loginEmail,
        senha: loginSenha,
      });
      setUser({
        id: data.usuario_id,
        nome: data.usuario_nome,
        email: data.usuario_email,
      });
      setView("home");
      setLoginEmail("");
      setLoginSenha("");
    } catch (err) {
      alert(err?.response?.data?.error || "Falha no login");
    }
  };

  const logout = () => {
    setUser(null);
    setView("login");
  };

  const [materiais, setMateriais] = useState([]);
  const [loadingMateriais, setLoadingMateriais] = useState(false);
  const [q, setQ] = useState("");

  const emptyMaterial = { id: null, nome: "", tipo: "", quantidade: 0 };
  const [materialForm, setMaterialForm] = useState(emptyMaterial);
  const [editandoId, setEditandoId] = useState(null);

  const carregarMateriais = async (term = q) => {
    setLoadingMateriais(true);
    try {
      const url = notEmpty(term) ? `/materiais?q=${encodeURIComponent(term)}` : "/materiais";
      const { data } = await API.get(url);
      setMateriais(Array.isArray(data) ? data : []);
    } catch (e) {
      alert("Erro ao carregar materiais");
    } finally {
      setLoadingMateriais(false);
    }
  };

  useEffect(() => {
    if (view === "materiais" || view === "estoque") carregarMateriais();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const materiaisOrdenados = useMemo(() => {
    return [...materiais].sort((a, b) =>
      a.material_nome.localeCompare(b.material_nome, "pt-BR", { sensitivity: "base" })
    );
  }, [materiais]);

  const limparMaterialForm = () => {
    setMaterialForm(emptyMaterial);
    setEditandoId(null);
  };

  const validarMaterialForm = () => {
    const { nome, quantidade } = materialForm;
    if (!notEmpty(nome)) return "Informe o nome do material.";
    if (toInt(quantidade) < 0) return "Quantidade não pode ser negativa.";
    return null;
  };

  const criarMaterial = async () => {
    const msg = validarMaterialForm();
    if (msg) return alert(msg);
    try {
      await API.post("/materiais", {
        nome: materialForm.nome.trim(),
        tipo: notEmpty(materialForm.tipo) ? materialForm.tipo.trim() : null,
        quantidade: toInt(materialForm.quantidade),
      });
      await carregarMateriais();
      limparMaterialForm();
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao criar material");
    }
  };

  const iniciarEdicao = (p) => {
    setEditandoId(p.material_id);
    setMaterialForm({
      id: p.material_id,
      nome: p.material_nome,
      tipo: p.material_tipo || "",
      quantidade: p.material_quantidade,
    });
  };

  const salvarMaterial = async () => {
    if (!editandoId) return;
    const msg = validarMaterialForm();
    if (msg) return alert(msg);
    try {
      await API.put(`/materiais/${editandoId}`, {
        nome: materialForm.nome.trim(),
        tipo: notEmpty(materialForm.tipo) ? materialForm.tipo.trim() : null,
        quantidade: toInt(materialForm.quantidade),
      });
      await carregarMateriais();
      limparMaterialForm();
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao salvar material");
    }
  };

  const excluirMaterial = async (id) => {
    if (!window.confirm("Excluir este material?")) return;
    try {
      await API.delete(`/materiais/${id}`);
      await carregarMateriais();
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao excluir material");
    }
  };

  const buscar = async (e) => {
    e?.preventDefault();
    await carregarMateriais(q);
  };

  const [movMaterialId, setMovMaterialId] = useState("");
  const [movData, setMovData] = useState(""); // date (yyyy-mm-dd)

  const registrarEmprestimo = async () => {
    if (!user) return alert("Faça login.");
    if (!movMaterialId) return alert("Selecione um material.");

    try {
      const payload = {
        material_id: Number(movMaterialId),
        usuario_id: user.id,
        data_esprestimo: notEmpty(movData) ? new Date(movData).toISOString() : null,
      };
      await API.post("/movimentoestoque", payload);
      alert("Empréstimo registrado com sucesso (1 unidade retirada).");
      await carregarMateriais();
      setMovData("");
    } catch (e) {
      alert(e?.response?.data?.error || "Erro ao registrar empréstimo");
    }
  };

  return (
    <div className="app-container">
      <h1>meia meia meia — Gestão de Estoque</h1>

      {view === "login" && (
        <section className="form" aria-label="login">
          <h2>Login</h2>
          <div className="input-container">
            <label>Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="ana@example.com"
              required
            />
          </div>
          <div className="input-container">
            <label>Senha</label>
            <input
              type="password"
              value={loginSenha}
              onChange={(e) => setLoginSenha(e.target.value)}
              placeholder="•••••••"
              required
            />
          </div>
          <button onClick={doLogin}>Entrar</button>
        </section>
      )}

      {view === "home" && (
        <section className="form" aria-label="home">
          <h2>Olá, {user?.nome}</h2>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setView("materiais")}>Cadastro de Material</button>
            <button onClick={() => setView("estoque")}>Gestão de Estoque</button>
            <button onClick={logout}>Sair</button>
          </div>
        </section>
      )}

      {view === "materiais" && (
        <section className="form" aria-label="materiais">
          <h2>Cadastro de Material</h2>

          <form onSubmit={buscar} style={{ width: "100%", display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Buscar por nome (ex.: bola)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button type="submit">Buscar</button>
            <button type="button" onClick={() => { setQ(""); carregarMateriais(""); }}>
              Limpar
            </button>
          </form>

          <div style={{ width: "100%", display: "grid", gap: 8 }}>
            <div className="input-container">
              <label>Nome</label>
              <input
                type="text"
                value={materialForm.nome}
                onChange={(e) => setMaterialForm((s) => ({ ...s, nome: e.target.value }))}
                placeholder='ex.: "Bola de Vôlei"'
                required
              />
            </div>
            <div className="input-container">
              <label>Tipo (opcional)</label>
              <input
                type="text"
                value={materialForm.tipo}
                onChange={(e) => setMaterialForm((s) => ({ ...s, tipo: e.target.value }))}
                placeholder='ex.: "Esportivo"'
              />
            </div>
            <div className="input-container">
              <label>Quantidade</label>
              <input
                type="number"
                value={materialForm.quantidade}
                onChange={(e) => setMaterialForm((s) => ({ ...s, quantidade: e.target.value }))}
                min={0}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {editandoId ? (
                <>
                  <button type="button" onClick={salvarMaterial}>Salvar alterações</button>
                  <button type="button" onClick={limparMaterialForm}>Cancelar</button>
                </>
              ) : (
                <button type="button" onClick={criarMaterial}>Cadastrar material</button>
              )}
              <button type="button" onClick={() => setView("home")}>Voltar</button>
            </div>
          </div>

          <div style={{ width: "100%", marginTop: 10 }}>
            {loadingMateriais && <p>Carregando...</p>}
            {!loadingMateriais && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Nome</th>
                    <th>Qtd</th>
                    <th>Tipo</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {materiaisOrdenados.map((p) => (
                    <tr key={p.material_id}>
                      <td>{p.material_nome}</td>
                      <td style={{ textAlign: "center" }}>{p.material_quantidade}</td>
                      <td style={{ textAlign: "center" }}>{p.material_tipo || "—"}</td>
                      <td style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                        <button type="button" onClick={() => iniciarEdicao(p)}>Editar</button>
                        <button type="button" onClick={() => excluirMaterial(p.material_id)}>Excluir</button>
                      </td>
                    </tr>
                  ))}
                  {materiaisOrdenados.length === 0 && (
                    <tr><td colSpan={4}>Nenhum material.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {view === "estoque" && (
        <section className="form" aria-label="estoque">
          <h2>Gestão de Estoque</h2>

          <div style={{ width: "100%" }}>
            <h3>Materiais (ordem alfabética)</h3>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
              {materiaisOrdenados.map((p) => (
                <li key={p.material_id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ width: "50%" }}>{p.material_nome}</span>
                  <span>Qtd: <b>{p.material_quantidade}</b></span>
                  <span>Tipo: <b>{p.material_tipo || "N/A"}</b></span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ width: "100%", marginTop: 10 }}>
            <h3>Registrar Empréstimo (Saída)</h3>
            <div className="input-container">
              <label>Material</label>
              <select
                value={movMaterialId}
                onChange={(e) => setMovMaterialId(e.target.value)}
                style={{ width: "100%", padding: 10, borderRadius: 5, border: "1px solid #ccc" }}
              >
                <option value="">Selecione...</option>
                {materiaisOrdenados.map((p) => (
                  <option key={p.material_id} value={p.material_id}>{p.material_nome}</option>
                ))}
              </select>
            </div>

            <div className="input-container">
              <label>Data do Empréstimo (opcional)</label>
              <input
                type="date"
                value={movData}
                onChange={(e) => setMovData(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={registrarEmprestimo}>Registrar Empréstimo</button>
              <button type="button" onClick={() => setView("home")}>Voltar</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}