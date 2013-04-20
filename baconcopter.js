var _       = require('underscore'),
    Bacon   = require('baconjs'),
    arDrone = require('ar-drone'),
    client  = arDrone.createClient({ip: '192.168.1.1'}),
    navdata = new Bacon.Bus();

client.on("navdata", navdata.push);
client.config('general:navdata_demo', 'FALSE');

navdata.onValue(_.bind(console.log, console));


// try flying
client.disableEmergency();
client.takeoff();

client.after(3000, function() {
    this.clockwise(0.5);
  })
  .after(3000, function() {
    this.stop();
    this.land();
  });