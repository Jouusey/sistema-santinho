
CREATE TABLE materiais (
material_id SERIAL PRIMARY KEY,
material_nome TEXT,
material_tipo VARCHAR(20),
material_quantidade INTEGER
)

INSERT INTO materiais (material_nome, material_tipo, material_quantidade) 
VALUES('Barbell', 'SuperTek, 1 kilos', 5)