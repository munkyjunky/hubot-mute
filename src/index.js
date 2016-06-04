/**
 * Description:
 *   Make hubot be quiet for a while
 *
 * Dependencies
 *   None
 *
 * Configuration:
 *   HUBOT_MUTE_CHECK_INTERVAL - How often Hubot checks for expired mutes (ms)
 *   HUBOT_MUTE_DEFAULT_TIME - Default time to mute hubot for (in minutes)
 *
 * Commands:
 *   hubot mute - mute the current channel
 *   hubot mute for X minutes - mute the current channel for X minutes
 *   hubot mute for X hours - mute the current channel for X hours
 *   hubot unmute - unmute the current channel
 *
 * Notes:
 *   Based on hubot-mute by Alex House @alexhouse
 *
 * Author:
 *   munkyjunky
 */

'use strict';

module.exports = (robot) => {

	const CHECK_INTERVAL = process.env.HUBOT_MUTE_CHECK_INTERVAL || 10000;
	const DEFAULT_MUTE_TIME = process.env.HUBOT_MUTE_DEFAULT_TIME || null;
	const BRAIN_STORE = 'mute_channels';
	let muted_channels = [];

	/*
		Complicated regular expressions to match times such as:

		mute for 1 hour
		mute for 2 hours 5 minutes
		mute 3 mins
		mute 1h30m
	 */
	const REGEX_FOR = '(?:\s+(?:for)?\s*)';
	const REGEX_HOURS = '(?:\s*(\d+)\s*h(?:our)?s?)?';
	const REGEX_MINUTES = '(?:\s*(\d+)\s*m(?:in(?:ute)?)?s?)?';

	/**
	 * Periodically check for expired mutes
	 */
	setInterval(() => {
		muted_channels = muted_channels.filter(i => (i.expire === null) || (i.expire - new Date() < 0));
		robot.brain.set(BRAIN_STORE, muted_channels);
	}, CHECK_INTERVAL);


	/**
	 * Get muted channels from brain
	 */
	robot.brain.on('loaded', () => {
		muted_channels = robot.brain.get(BRAIN_STORE) || muted_channels;
	});


	/**
	 * Mute current channel on request
	 */
	robot.respond(new RegExp(`mute${REGEX_FOR}${REGEX_HOURS}${REGEX_MINUTES}$`,'i'), msg => {
		msg.finish();

		const hours = msg.match(1) || 0;
		const minutes = msg.match(2) || 0;

		let expire = DEFAULT_MUTE_TIME;

		// If a time was passed use it for the expiry
		if (hours > 0 || minutes > 0) {
			expire = new Date(new Date().getTime() + (hours*60*60*1000) + (minutes*60*1000));

		// if no time was passed use the default expiry if set
		} else if (expire !== null) {
			expire = new Date().getTime() + DEFAULT_MUTE_TIME*60*1000;
		}

		muted_channels.push({ room: msg.message.room, expire });
		robot.brain.set(BRAIN_STORE, muted_channels);
	});


	/**
	 * Unmute current channel on request
	 */
	robot.respond(/unmute$/i, msg => {
		msg.finish();
		muted_channels = muted_channels.filter(i => i.name !== msg.message.room);
		robot.brain.set(BRAIN_STORE, muted_channels);
	});


	/**
	 * List currently muted channels, with expiry time if set
	 */
	robot.respond(/mute list$/i, msg => {

		if (muted_channels.length === 0) {
			msg.reply('No channels are muted');
		}

		muted_channels.forEach(muted => {
			msg.send(`${muted.room} is muted ${ muted.expire ? 'until ' + muted.expire.toLocaleTimeString() : '' }`)
		});

	});

	
	/**
	 * Stop the response chain if the room is in the muted channels list
	 */
	robot.responseMiddleware((context, next, done) => {
		let match = muted_channels.filter(i => i.name === context.response.message.room);
		match.length > 0 ? done() : next();
	});

};
