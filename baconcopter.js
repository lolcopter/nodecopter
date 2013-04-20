var _       = require('underscore'),
    server  = require('./lib/server'),
    Bacon   = require('baconjs'),
    cv      = require('opencv'),
    arDrone = require('ar-drone'),
    client  = arDrone.createClient({ip: '192.168.1.1'}),
    pngStream = new Bacon.Bus(),
    pngStreamThrottled = pngStream.throttle(1000),
    navdata = new Bacon.Bus(),
    flyingStr = new Bacon.Bus(),
    flying = flyingStr.skipDuplicates().toProperty(false),

    navdataclean = navdata
      .map(function(it) {
        if (!it.demo) {
          return null;
        } else {
          return it;
        }
    }).filter(function(it) { return it != null }),

    altitude = navdataclean.map(function(it) {
      return it.demo.altitude
    }).skipDuplicates(),

    battery = navdataclean.map(function(it) {
      return it.demo.batteryPercentage;
    }).skipDuplicates(),

    toolow  = altitude.map(function(it) {
      return it < 1;
    }).skipDuplicates(),

    toohigh = altitude.map(function(it) {
      return it > 2;
    }).skipDuplicates(),

    faces   = pngStreamThrottled.flatMapLatest(function(it) {
      return Bacon.fromNodeCallback(cv.readImage, it);
    }).flatMapLatest(function(it) {
      return Bacon.fromCallback(function(callback) {
        it.detectObject("node_modules/opencv/data/haarcascade_frontalface_alt2.xml", {}, function (err, faces) {
          callback(faces);
        });
      })
    }).map(function(it) {
      return it;
    }).skipDuplicates(),
    numFaces = faces.map(function(it) { return it.length }).skipDuplicates().toProperty();

    stateSummary = Bacon.combineTemplate({
      altitude: altitude,
      battery: battery,
      png: pngStreamThrottled.map(function(it) { return it.toString('base64'); }).toProperty(),
      numFaces: numFaces
    });

// try flying
client.disableEmergency();

client.config('general:navdata_demo', 'FALSE');
client.on("navdata", navdata.push);
client.createPngStream().on('data', pngStream.push);

toolow.filter(function(it) {
      return it;
    }).filter(flying).onValue(function() {
    client.up(1);
});

toohigh.filter(function(it) {
      return it;
}).filter(flying).onValue(function() {
  client.down(1);
});

flying.onValue(function(flying) {
  console.log("flying", flying);
  if (flying) {
    client.takeoff();
  } else {
    client.stop();
    client.land();
  }
})

var server = server.start(3000);
server.onInput(function(data) {
  flyingStr.push(true);
  setTimeout(function() {
    flyingStr.push(false);
  }, 10000)
})

stateSummary.throttle(100).onValue(server.emit);