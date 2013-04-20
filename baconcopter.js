var _       = require('underscore'),
    server  = require('./lib/server'),
    Bacon   = require('baconjs'),
    cv      = require('opencv'),
    arDrone = require('ar-drone'),
    client  = arDrone.createClient({ip: '192.168.1.1'}),
    flyingStr = new Bacon.Bus(),
    flying = flyingStr.skipDuplicates().toProperty(false),
    pngStream = new Bacon.Bus(),
    pngStreamThrottled = pngStream.toProperty().sample(250),
    navdata = new Bacon.Bus(),
    takeAction = new Bacon.Bus(),

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
    }),

    toohigh = altitude.map(function(it) {
      return it > 1.5;
    }),
    image   = pngStreamThrottled
              //.filter(flying).filter(toohigh.toProperty())
              .flatMapLatest(function(it) {
      return Bacon.fromNodeCallback(cv.readImage, it);
    }),
    faces   = image.flatMapLatest(function(it) {
      return Bacon.fromCallback(function(callback) {
        it.detectObject("node_modules/opencv/data/haarcascade_frontalface_alt_tree.xml", {}, function (err, faces) {
          callback(faces);
        });
      })
    }).map(function(it) {
      return it;
    }),
    biggestFace = faces.map(function(it) {
      return _.sortBy(_.map(it, function(face) { return {x: face.x, y: face.y, height: face.height, width: face.width, size: face.width * face.height } }), function(it) { return it.size })
    }).map(function(it) {
      if (it.length > 0) {
        return _.last(it);
      } else {
        return null;
      }
    }),
    newImage = image.zip(biggestFace).map(function(args) {
        var image = args[0],
            x = args[1];
        if (x == null) {
          return image.toBuffer();
        } else {
          image.ellipse(x.x + x.width/2, x.y + x.height/2, x.width/2, x.height/2);
          return image.toBuffer();
        }
    }),
    xFace1   = faces.filter(function(it) { return it.length > 0 }).map(function(it) { return it[0].x }).toProperty(),    
    numFaces = faces.map(function(it) { return it.length }).skipDuplicates().toProperty(0),
    turnDirection = numFaces
                      .changes()
                      .filter(function(it) { return it == 0; })
                      .map(Bacon.constant("stop"))
                      .merge(
                        biggestFace.map(function(it) {
                          if (it == null) {
                            return "stop"
                          } else if (it.x < 200) {
                            return "left"
                          } else if (it.x > 440) {
                            return "right"
                          } else {
                            return "stop"
                          }
                        })
                      ).toProperty(0);

    stateSummary = Bacon.combineTemplate({
      altitude: altitude,
      battery: battery,
      numFaces: numFaces,
      png: newImage.map(function(it) { return it.toString('base64'); })
    });
newImage.onValue(function() {});

// try flying
client.disableEmergency();

client.config('general:navdata_demo', 'FALSE');
client.on("navdata", navdata.push);
client.createPngStream().on('data', pngStream.push);

toolow.filter(flying).filter(function(it) {
    return it;
  }).onValue(function() {
    client.up(1);
});

toohigh.filter(flying).filter(function(it) {
  return it;
}).onValue(function() {
    client.down(0);
});

flying.onValue(function(flying) {
  if (flying) {
    client.takeoff();
  } else {
    client.stop();
    client.land();
  }
})

var action = ["stop", 50];
biggestFace.map(function(face) {
  if (face == null) {
    return ["stop", 50];
  } else {
    var diff = Math.abs(320 - face.x)
    var ms = Math.min((diff / 4.54) * 0.01 * 1000, 100);
    if (face.x < 200) {
      return ["left", ms, face.x];
    } else if (face.x > 440) {
      return ["right", ms, face.x];
    } else {
      return ["stop", 50];
    }
  }
}).onValue(function(it) {
  action = it;
});
var doIt = function() {
  console.log(action);
  if (action[0] == "left") {
    client.counterClockwise(0.5);
  } else if (action[0] == "right") {
    client.clockwise(0.5);
  } else {
    client.stop();
  }

  setTimeout(doIt, action[1]);
  action = ["stop", 50];
}
setTimeout(doIt, 200)

var server = server.start(3000);
server.onInput(function(data) {
  if (data.takeoff) {
    flyingStr.push(true);
  } else if (data.land) {
    flyingStr.push(false);
  }
})

stateSummary.sample(500).onValue(server.emit);