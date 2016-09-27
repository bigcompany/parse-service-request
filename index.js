var mergeParams = require('merge-params');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();

module['exports'] = function parseRequestBody (req, res, next) {
  var fields = {};
  var acceptTypes = [];
  // auto-assigns req.jsonResponse boolean for use later ( it's useful to know )
  if (req.headers && req.headers.accept) {
    acceptTypes = req.headers.accept.split(',');
  }
  if (acceptTypes.indexOf('text/html') === -1) {
    req.jsonResponse = true;
  }

  if (req.method === "POST" || req.method === "PUT") {

    // only attempt to parse body if its multipart form or urlencoded form, if not
    // do not parse as we don't want to interrupt req
    var contentTypes = [];
    if (req.headers && req.headers['content-type']) {
      contentTypes = req.headers['content-type'].split(';');
    }

    //
    // If a content-type of multipart/form-data or application/x-www-form-urlencoded is detected,
    // use busboy to parse the incoming form.
    //
    // For multipart file uploads:
    //   Each file is added to the request.resource.params as a pipe,
    //   this file upload pipe can later be processed by the hook
    //
    if (contentTypes.indexOf("multipart/form-data") !== -1 ||
        contentTypes.indexOf("application/x-www-form-urlencoded") !== -1) {
      var Busboy = require('busboy');
      var inspect = require('util').inspect;

      // create two busboy instances
      // one for parsing multipart form files, another for parsing urlencoded form fields
      var busboyFiles = new Busboy({ headers: req.headers });
      var busboyFields = new Busboy({ headers: req.headers });
      // console.log('parsing')
      // a multipart file upload was detected, add this upload pipe to the resource params
      busboyFiles.on('file', function(fieldname, file, filename, encoding, mimetype) {
        // console.log('found file', fieldname);
        fields[fieldname] = file;
      });

      // a urlencoded form field was detected, add it's value to resource params
      busboyFields.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
        // console.log('found field', fieldname, val);
        fields[fieldname] = val;
      });

      // when all fields have been parsed, merge the resource params and continue
      busboyFields.on('finish', function() {
        mergeParams(req, res, function(){
          for (var p in fields) {
            req.resource.params[p] = fields[p];
          }
          next(req, res, req.resource.params);
        });
      });

      // when all multipart files have been uploaded, do nothing
      // these upload file pipes should be handled by the user-defined Hook
      busboyFiles.on('finish', function() {
        // do nothing
      });

      // pipe the incoming request to busboy for processing
      req.pipe(busboyFiles);
      req.pipe(busboyFields);

      // removed? piping should end the response?
      // do we have any uncaught stream errors here?
      //return next(req, res);

    } else if (req.jsonResponse) {

      jsonParser(req, res, function jsonParserCallback (err, fields) {

        if (typeof fields !== "undefined") {
          req.body = fields;
        }
        // could have error here due to invalid json
        // current behavior is to ignore bad json and continue request
        if (err) {
          console.log('Error in parsing JSON:', err);
          // return next(err);
        }
        mergeParams(req, res, function mergeParamsCallback () {
          next(req, res, req.body);
        });
      });
    } else {
      // Incoming request was a POST, but did not contain content types of multipart or urlencoded form
      // This means we should treat the incoming request is a streaming request
      next(req, res, req.body);
    }
  } else {
    mergeParams(req, res, function mergeParamsCallback () {
      next(req, res, req.body);
    });
  }
}
