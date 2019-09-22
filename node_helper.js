/* global Module */

/* node_helper.js
 *
 * Magic Mirror
 * Module: MMM-BackgroundSlideshow
 *
 * Magic Mirror By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Module MMM-BackgroundSlideshow By Darick Carpenter
 * MIT Licensed.
 */

// call in the required classes
var NodeHelper = require('node_helper');
var FileSystemImageSlideshow = require('fs');
var request = require('request');

// the main module helper create
module.exports = NodeHelper.create({
  // subclass start method, clears the initial config array
  start: function() {
    //this.moduleConfigs = [];
  },
  // shuffles an array at random and returns it
  shuffleArray: function(array) {
    var currentIndex = array.length,
      temporaryValue,
      randomIndex;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  },
  // sort by filename attribute
  sortByFilename: function(a, b) {
    aL = a.toLowerCase();
    bL = b.toLowerCase();
    if (aL > bL) return 1;
    else return -1;
  },
  // checks there's a valid image file extension
  checkValidImageFileExtension: function(filename, extensions) {
    var extList = extensions.split(',');
    for (var extIndex = 0; extIndex < extList.length; extIndex++) {
      if (filename.toLowerCase().endsWith(extList[extIndex])) return true;
    }
    return false;
  },
  getPlexImagesFromAlbum(url, token, albumId, cb) {
    var options = {
      url: `${url}/playlists/${albumId}/items`,
      method: 'GET',
      headers: { 
        'X-Plex-Token': token,
        'Accept': 'application/json'
      },
      json:true
    };

    request(options, function(error, response, body) {
      if (error || response.statusCode !== 200) {
        console.log(`error fetching plex metadata: ${response.statusCode}: ${error}`);
        cb([]);
      }

      imageUrls = [];
      items = body.MediaContainer.Metadata;

      for(var i = 0; i < items.length; i++) {
        imageUrls.push(items[i].Media[0].Part[0].key);
      }

      cb(imageUrls);
    });
  },
  // gathers the image list
  gatherImageList(config, cb) {
    const self = this;
    // create an empty main image list
    var imageList = [];

    if (config.plexToken) {
      self.getPlexImagesFromAlbum(
        config.plexUrl, 
        config.plexToken, 
        config.plexAlbum,
        function(images) {
          const imageList = config.randomizeImageOrder ? self.shuffleArray(images) : images.sort(self.sortByFilename);
          cb(imageList); 
        });
    } else {
      for (var i = 0; i < config.imagePaths.length; i++) {
        self.getFiles(config.imagePaths[i], imageList, config);
      }

      imageList = config.randomizeImageOrder
        ? self.shuffleArray(imageList)
        : imageList.sort(self.sortByFilename);

      cb(imageList);
    }
  },

  getFiles(path, imageList, config) {
    var contents = FileSystemImageSlideshow.readdirSync(path);
    for (let i = 0; i < contents.length; i++) {
      var currentItem = path + '/' + contents[i];
      var stats = FileSystemImageSlideshow.lstatSync(currentItem);
      if (stats.isDirectory() && config.recursiveSubDirectories) {
        this.getFiles(currentItem, imageList, config);
      } else if (stats.isFile()) {
        var isValidImageFileExtension = this.checkValidImageFileExtension(
          currentItem,
          config.validImageFileExtensions
        );
        if (isValidImageFileExtension) imageList.push(currentItem);
      }
    }
  },
  // subclass socketNotificationReceived, received notification from module
  socketNotificationReceived: function(notification, configuration) {
    if (notification === 'BACKGROUNDSLIDESHOW_REGISTER_CONFIG') {
      // this to self
      var self = this;
      // get the image list
      this.gatherImageList(configuration, function(imageList) {
        // build the return payload
        var returnPayload = {
          identifier: configuration.identifier,
          imageList: imageList,
          plexUrl: configuration.plexUrl,
          plexToken: configuration.plexToken
        };

        // send the image list back
        self.sendSocketNotification(
          'BACKGROUNDSLIDESHOW_FILELIST',
          returnPayload
        );
      });
    }
  }
});

//------------ end -------------
