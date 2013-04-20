var _       = require('underscore'),
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
    }).skipDuplicates()
    toolow  = altitude.map(function(it) {
      return it < 1;
    }).skipDuplicates();
    toohigh  = altitude.map(function(it) {
      return it > 2;
    }).skipDuplicates(),
    landing = false;

// try flying
client.disableEmergency();

client.config('general:navdata_demo', 'FALSE');
client.on("navdata", navdata.push);

client.takeoff();

toolow.filter(function(it) {
      return it;
    }).onValue(function() {
  console.log("toolow");
  if (!landing) {
    client.up(1);
  }
});
battery.map(function(it) { return "battery: " + it + "%" }). log();

toohigh.filter(function(it) {
      return it;
}).onValue(function() {
  console.log("toohigh");
  if (!landing) {
    client.down(1);
  }
});

client
  .after(20000, function() {
    landing = true;
    this.stop();
    this.land();
  });