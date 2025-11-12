CREATE TABLE usuarios (
usuario_id SERIAL PRIMARY KEY,
usuario_nome TEXT,
usuario_treinador BOOLEAN,
usuario_senha VARCHAR(25),
usuario_email VARCHAR(90),
usuario_codigo_funcionario VARCHAR(11)
)

INSERT INTO usuarios (usuario_nome, usuario_treinador, usuario_senha, usuario_email, usuario_codigo_funcionario)
VALUES('Gustavo',FALSE,'12345','gustavo@gmail.com',NULL)
