#IRC Client in the browser
This is a fork of the project from [Nodester](https://github.com/nodester/irc) and customized for [Lullabot](http://lullabot.com).

Currently this simply joins #lullabuddies but I have plans to list out some official channels for clients that are password protected and allow them to input their channel password when they choose a password protected room.

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
    ![welcome](https://img.skitch.com/20120331-d57xgxfkrte1ksnprcdus12um9.jpg)