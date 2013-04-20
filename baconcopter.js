var _       = require('underscore'),
    server  = require('./lib/server'),
    Bacon   = require('baconjs'),
    cv      = require('opencv'),
    arDrone = require('ar-drone'),
    client  = arDrone.createClient({ip: '192.168.1.1'}),
    flyingStr = new Bacon.Bus(),
    flying = flyingStr.skipDuplicates().toProperty(false),
    pngStream = new Bacon.Bus(),
    pngStreamThrottled = pngStream.throttle(100),
    navdata = new Bacon.Bus(),

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

    }),
    newImage = image.zip(faces).map(function(args) {
        var image = args[0],
            faces = args[1];

        for (var i=0;i<faces.length; i++){
          var x = faces[i]
          image.ellipse(x.x + x.width/2, x.y + x.height/2, x.width/2, x.height/2);
        }
        return image.toBuffer();
    }),
    xFace1   = faces.filter(function(it) { return it.length > 0 }).map(function(it) { return it[0].x }).toProperty(),    
    numFaces = faces.map(function(it) { return it.length }).skipDuplicates().toProperty(0),
    turnDirection = numFaces
                      .changes()
                      .filter(function(it) { return it == 0; })
                      .map(Bacon.constant("stop"))
                      .merge(
                        xFace1.changes().map(function(it) {
                          if (it < 300) {
                            return "left"
                          } else if (it > 340) {
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

turnDirection.onValue(function(it) {
  switch (it) {
    case "left":
      console.log("turning left...")
      client.counterClockwise(0.2);
      break;
    case "right":
      console.log("turning right...")
      client.clockwise(0.2);
      break;
    case "stop":
      console.log("stopping")
      client.clockwise(0);
      break;
  }
})

var server = server.start(3000);
server.onInput(function(data) {
  flyingStr.push(true);
  setTimeout(function() {
    flyingStr.push(false);
  }, 30000)
})

stateSummary.sample(250).onValue(server.emit);