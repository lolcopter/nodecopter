var arDrone = require('ar-drone');
var client  = arDrone.createClient();


client.takeoff();


client.after(10000, function() {

	var anims = ['phiM30Deg', 'phi30Deg', 'thetaM30Deg', 'theta30Deg', 'theta20degYaw200deg',
	'theta20degYawM200deg', 'turnaround', 'turnaroundGodown', 'yawShake',
	'yawDance', 'phiDance', 'thetaDance', 'vzDance', 'wave', 'phiThetaMixed',
	'doublePhiThetaMixed', 'flipAhead', 'flipBehind', 'flipLeft', 'flipRight'];
	var blinks = ['blinkGreenRed', 'blinkGreen', 'blinkRed', 'blinkOrange', 'snakeGreenRed',
	'fire', 'standard', 'red', 'green', 'redSnake', 'blank', 'rightMissile',
	'leftMissile', 'doubleMissile', 'frontLeftGreenOthersRed',
	'frontRightGreenOthersRed', 'rearRightGreenOthersRed',
	'rearLeftGreenOthersRed', 'leftGreenRightRed', 'leftRedRightGreen',
	'blinkStandard'];
	var start = 0
	for (var i = 0; i < anims.length; i++) {
		var anim = anims[i];
		var blink = blinks[i];
		client.after(i * 3000, function() { 
			console.log(anim);
			client.animateLeds(blink, 1 + (i%2), 2500);
			client.animate(anim, 2500);
			console.log('Next animation!')
		});
	}


	client.after(anims.length * 3000, function() {
		client.stop();
		client.land();
	})

})
