const http = require('http');
const url = require('url');
const stream = require('stream');
const fs = require('fs');

const server = http.createServer(function (request, response) {
    const parsedURL = url.parse(request.url, true);
    const path = parsedURL.pathname;
    const query = parsedURL.query;

    function sendMessage(code, msg){
        response.writeHead(codigo, {'Content-Type': 'text/plain; charset=utf-8'});
        response.end(msg);
    }
    // LOGIN (200 - login bem sucedido, 401 - login não ocorre pois nick/password estão mal)
    if(path !== 'admin' || password !== '1234'){ // wtf
        response.writeHead(401, {'Content-Type': 'text/plain; charset=utf-8'});
        response.end('401 Unauthorized: Credenciais inválidas.');
        return;
    }
    response.writeHead('200', {'Content-Type': 'text/plain; charset=utf-8'});
    response.end('200 OK: Bem vindo ${nick}! Login feito com sucesso.');


});


server.listen(PORT, 'localhost', () => {
    console.log('Server running at http://localhost:${PORT}/');
});
