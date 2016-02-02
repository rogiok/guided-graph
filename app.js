var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');

var app = express();

app.get('/service', function (req, res) {
    res.location('http://demo/power');
    res.send({"response": req.query.q});
});

app.get('/notfound', function (req, res) {
    res.send(404, 'Sorry, we cannot find that!');
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use('/graph', express.static(path.join(__dirname, 'public')));
app.use('/', express.static(path.join(__dirname, 'public')));

module.exports = app;
