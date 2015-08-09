var mergeParams = require('merge-params');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
//console.log('sanity');
module['exports'] = function parseRequestBody (req, res, next) {
  var fields = {};
//  console.log('parse service request', req.url);
//  console.log(req)
  if (req.method === "GET") {
  //  console.log('get method');
    return mergeParams(req, res, function(){
      return next(req, res);
    });
  } else if (req.method === "POST") {
//    console.log('post');
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
//      console.log('parsing')
      // a multipart file upload was detected, add this upload pipe to the resource params
      busboyFiles.on('file', function(fieldname, file, filename, encoding, mimetype) {
//        console.log('found file', fieldname);
        fields[fieldname] = file;
      });

      // a urlencoded form field was detected, add it's value to resource params
      busboyFields.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
//        console.log('found field', fieldname, val);
        fields[fieldname] = val;
      });

      // when all fields have been parsed, merge the resource params and continue
      busboyFields.on('finish', function() {
        mergeParams(req, res, function(){
          next(req, res, fields);
        })
      });

      // when all multipart files have been uploaded, do nothing
      // these upload file pipes should be handled by the user-defined Hook
      busboyFiles.on('finish', function() {
        // do nothing
      });

      // pipe the incoming request to busboy for processing
      req.pipe(busboyFiles);
      req.pipe(busboyFields);

      //return next(req, res);
    

    } else if (contentTypes.indexOf("application/json") !== -1 ) {
      jsonParser(req, res, function(){
        next(req, res, {});
      });
    } else {
      // Incoming request was a POST, but did not contain content types of multipart or urlencoded form
      // This means we should treat the incoming request is a streaming request
      next(req, res, {});
    }
  }
}
