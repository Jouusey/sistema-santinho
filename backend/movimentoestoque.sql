
CREATE TABLE movimentoestoque (
movimentoestoque_id  SERIAL PRIMARY KEY,
material_id INTEGER,
usuario_id INTEGER,
CONSTRAINT fk_materiais FOREIGN KEY (material_id) 
REFERENCES materiais(material_id),
        
CONSTRAINT fk_usuarios
FOREIGN KEY (usuario_id) 
REFERENCES usuarios(usuario_id),

material_disponivel BOOLEAN,
material_data_esprestimo DATE,
material_data_devolucao DATE
)


INSERT INTO movimentoestoque ( 
material_id, usuario_id, material_disponivel, material_data_esprestimo, 
material_data_devolucao) VALUES
(1,1,FALSE,'2025-11-01',NULL)