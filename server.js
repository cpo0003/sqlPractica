const express = require('express');
var fs = require('fs');
const bodyParser = require('body-parser');
const mysql = require('mysql');
var https = require('https');

const app = express();
var port = process.env.PORT || 3000;
var server = require('http').Server(app);

app.use(express.json());
app.use(express.static('public'));

//conexion clever cloud
const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'b8mc9vz6ljjpnriiutdv-mysql.services.clever-cloud.com',
    user: 'uo2byfo7odhafqyw',
    password: '7EnLGrUgaTsTwP8TIIg2',
    database: 'b8mc9vz6ljjpnriiutdv'
})



//FUNCIONES GET
app.get('/', (req, response) => {
    var contenido = fs.readFileSync("public/index.html");
    response.setHeader("Content-type", "text/html");
    response.send(contenido);
});

// CONSULTA EN LA BASE DE DATOS DE WORDPREsS "basedepruebas", en la tabla "wp_options" buscamos en la columna "option_name" el campo que es igual a "home"
// Modificar las rutas para devolver HTML en lugar de JSON
app.post('/mostrarCursos', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;
        connection.query('SELECT * FROM cursos', (err, rows) => {
            connection.release();
            if (err) throw err;
            let html = '<table border="1"><tr><th>Nombre</th><th>Nivel</th><th>Descripción</th><th>Lugar</th><th>Fecha Importación</th></tr>';
            rows.forEach(row => {
                html += `<tr><td>${row.nombre}</td><td>${row.nivel}</td><td>${row.descripcion}</td><td>${row.lugar}</td><td>${row.fechaimportacion}</td></tr>`;
            });
            html += '</table>';
            res.send(html);
        });
    });
});

// Ruta para mostrar los centros
app.post('/mostrarCentros', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;
        connection.query('SELECT * FROM centros', (err, rows) => {
            connection.release();
            if (err) throw err;
            let html = '<table border="1"><tr><th>Nombre</th></tr>';
            rows.forEach(row => {
                html += `<tr><td>${row.nombre}</td></tr>`;
            });
            html += '</table>';
            res.send(html);
        });
    });
});


// Ruta para mostrar los alumnos y sus notas
app.post('/mostrarAlumnosNotas', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;
        connection.query('SELECT a.id, a.nombre AS nombre_alumno, c.nombre AS nombre_curso, ac.nota FROM alumnos AS a INNER JOIN alumnosCursos AS ac ON a.id = ac.idAlumno INNER JOIN cursos AS c ON ac.idCurso = c.id;', (err, rows) => {
            connection.release();
            if (err) throw err;
            let html = '<table border="1"><tr><th>Nombre Alumno</th><th>Nombre Curso</th><th>Nota(1-10)</th><th>Eliminar Alumno</th></tr>';
            rows.forEach(row => {
                html += `<tr><td>${row.nombre_alumno}</td><td>${row.nombre_curso}</td><td>${row.nota}</td><td><button onclick="eliminarAlumno(${row.id})">Eliminar</button></td></tr>`;
            });
            html += '</table>';
            res.send(html);
        });
    });
});




// Ruta para eliminar un alumno
app.post('/eliminarAlumno', (req, res) => {
    const idAlumno = req.query.id; // Obtener el ID del alumno de la consulta

    // Eliminar las filas correspondientes en la tabla alumnosCursos
    pool.getConnection((err, connection) => {
        if (err) throw err;
        connection.query('DELETE FROM alumnosCursos WHERE idAlumno = ?', idAlumno, (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al eliminar las relaciones de cursos del alumno:', err);
                res.status(500).send('Error al eliminar las relaciones de cursos del alumno');
            } else {
                // Una vez eliminadas las relaciones, eliminar el alumno de la tabla alumnos
                pool.getConnection((err, connection) => {
                    if (err) throw err;
                    connection.query('DELETE FROM alumnos WHERE id = ?', idAlumno, (err, result) => {
                        connection.release();
                        if (err) {
                            console.error('Error al eliminar el alumno:', err);
                            res.status(500).send('Error al eliminar el alumno');
                        } else {
                            console.log('Alumno eliminado correctamente');
                            res.sendStatus(200); // OK
                        }
                    });
                });
            }
        });
    });
});

// Ruta para obtener los datos necesarios
app.get('/ratioAprobados', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) throw err;
        connection.query('SELECT c.nombre AS nombre_curso, COUNT(ac.nota >= 5 OR NULL) AS aprobados, COUNT(*) AS total FROM cursos AS c LEFT JOIN alumnosCursos AS ac ON c.id = ac.idCurso GROUP BY c.nombre', (err, rows) => {
            connection.release();
            if (err) {
                console.error('Error al obtener los datos:', err);
                res.status(500).send('Error al obtener los datos');
            } else {
                res.send(rows);
            }
        });
    });
});

// Método para obtener todos los cursos
app.get('/cursos', (req, res) => {
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error de conexión a la base de datos:', err);
            res.status(500).send('Error de conexión a la base de datos');
            return;
        }
        connection.query('SELECT id, nombre FROM cursos', (err, rows) => {
            connection.release();
            if (err) {
                console.error('Error al obtener los cursos:', err);
                res.status(500).send('Error al obtener los cursos');
            } else {
                res.json(rows);
            }
        });
    });
});

// Método para obtener la información de un curso específico
app.get('/curso', (req, res) => {
    const idCurso = req.query.id;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error de conexión a la base de datos:', err);
            res.status(500).send('Error de conexión a la base de datos');
            return;
        }
        connection.query('SELECT * FROM cursos WHERE id = ?', idCurso, (err, rows) => {
            connection.release();
            if (err) {
                console.error('Error al obtener el curso:', err);
                res.status(500).send('Error al obtener el curso');
            } else {
                if (rows.length === 1) {
                    res.json(rows[0]);
                } else {
                    res.status(404).send('Curso no encontrado');
                }
            }
        });
    });
});

// Método para actualizar la información de un curso
app.post('/actualizarCurso', (req, res) => {
    const { id, nombre, nivel, descripcion, lugar, fechaImportacion } = req.body;
    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error de conexión a la base de datos:', err);
            res.status(500).send('Error de conexión a la base de datos');
            return;
        }
        connection.query('UPDATE cursos SET nombre = ?, nivel = ?, descripcion = ?, lugar = ?, fechaimportacion = ? WHERE id = ?', [nombre, nivel, descripcion, lugar, fechaImportacion, id], (err, result) => {
            connection.release();
            if (err) {
                console.error('Error al actualizar el curso:', err);
                res.status(500).send('Error al actualizar el curso');
            } else {
                console.log('Curso actualizado correctamente');
                res.sendStatus(200);
            }
        });
    });
});


//FUNCION MAIN DEL SERVIDOR
app.listen(port, () => {
    console.log('App escuchando en el puerto 3000');
});