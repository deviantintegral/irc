#IRC Client in the browser
This is a fork of the project from [Nodester](https://github.com/nodester/irc) and customized for [Lullabot](http://lullabot.com).

You can currently use this to join any channel on irc.freenode.net, however, so as to limit potential abuse, I'd like to implement a whitelist of channels in the config that can be joined. See https://github.com/Lullabot/irc/issues/6

##Installation

###Prerequisites

 * node
 * npm

###Instructions

1. Clone this project and run:

    $ npm install

    _This will grab the neccessary modules for the package._

2. Modify config.js to point to the IRC channel you want to join.

2. From your terminal go into your checkout and run:

    $ node irc.js

    _This will simply tell you it's running._

3. Go to http://localhost:8080 in your browser.

    You should see something like this:
    ![welcome](https://img.skitch.com/20120819-rt7ypuwdiakted1hdk6d2fusw4.png)