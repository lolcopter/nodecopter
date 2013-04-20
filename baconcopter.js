var _       = require('underscore'),
    server  = require('./lib/server'),
    Bacon   = require('baconjs'),
    arDrone = require('ar-drone'),
    client  = arDrone.createClient({ip: '192.168.1.1'}),
    navdata = new Bacon.Bus(),
    navdataclean = navdata.map(function(it) {
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
    toohigh  = altitude.map(function(it) {
      return it > 2;
    }).skipDuplicates(),
    stateSummary = Bacon.combineTemplate({
      altitude: altitude,
      battery: battery
    }),
    landing = false;

// try flying
client.disableEmergency();

client.config('general:navdata_demo', 'FALSE');
client.on("navdata", navdata.push);

toolow.filter(function(it) {
      return it;
    }).onValue(function() {
  console.log("toolow");
  if (!landing) {
    client.up(1);
  }
});

toohigh.filter(function(it) {
      return it;
}).onValue(function() {
  console.log("toohigh");
  if (!landing) {
    client.down(1);
  }
});

var server = server.start(3000);
server.onInput(function(data) {
    client.takeoff();
    client
      .after(20000, function() {
        landing = true;
        this.stop();
        this.land();
      });
})

stateSummary.onValue(server.emit);