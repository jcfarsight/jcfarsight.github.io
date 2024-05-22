// TODO: Add receiver code here
const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

// Debug Logger
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const LOG_TAG = 'MyAPP.LOG';

// Enable debug logger and show a 'DEBUG MODE' overlay at top left corner.
context.addEventListener(cast.framework.system.EventType.READY, () => {
  if (!castDebugLogger.debugOverlayElement_) {
      castDebugLogger.setEnabled(true);

      // Show debug overlay
      castDebugLogger.showDebugLogs(true);

      // Clear log messages on debug overlay
      castDebugLogger.clearDebugLogs();      
  }
});

// Set verbosity level for Core events.
castDebugLogger.loggerLevelByEvents = {
    'cast.framework.events.category.CORE': cast.framework.LoggerLevel.INFO,
    'cast.framework.events.EventType.MEDIA_STATUS': cast.framework.LoggerLevel.DEBUG
  }

// Set verbosity level for custom tags.
castDebugLogger.loggerLevelByTags = {
    [LOG_TAG]: cast.framework.LoggerLevel.DEBUG,
};

function makeRequest (method, url) {
    return new Promise(function (resolve, reject) {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(JSON.parse(xhr.response));
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText
          });
        }
      };
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      };
      xhr.send();
    });
  }
  
  playerManager.setMessageInterceptor(
      cast.framework.messages.MessageType.LOAD,
      request => {
        castDebugLogger.info(LOG_TAG, 'Intercepting LOAD request');

        // Map contentId to entity
        if (request.media && request.media.entity) {
            request.media.contentId = request.media.entity;
        }

        return new Promise((resolve, reject) => {
          // Fetch content repository by requested contentId
          makeRequest('GET', 'https://storage.googleapis.com/cpe-sample-media/content.json').then(function (data) {
            let item = data[request.media.contentId];
            if(!item) {
              // Content could not be found in repository
              castDebugLogger.error(LOG_TAG, 'Content not found');
              reject();
            } else {
              castDebugLogger.warn(LOG_TAG, 'Playable URL:', request.media.contentUrl);

              // Adjusting request to make requested content playable
              request.media.contentUrl = item.stream.dash;
              request.media.contentType = 'application/dash+xml';

              // Add metadata
              let metadata = new
                 cast.framework.messages.GenericMediaMetadata();
              metadata.title = item.title;
              metadata.subtitle = item.author;

              request.media.metadata = metadata;
  
              // Resolve request
              resolve(request);
            }
          });
        });
      });

// Optimizing for smart displays
const touchControls = cast.framework.ui.Controls.getInstance();
const playerData = new cast.framework.ui.PlayerData();
const playerDataBinder = new cast.framework.ui.PlayerDataBinder(playerData);

let browseItems = getBrowseItems();

function getBrowseItems() {
  let browseItems = [];
  makeRequest('GET', 'https://storage.googleapis.com/cpe-sample-media/content.json')
  .then(function (data) {
    for (let key in data) {
      let item = new cast.framework.ui.BrowseItem();
      item.entity = key;
      item.title = data[key].title;
      item.subtitle = data[key].description;
      item.image = new cast.framework.messages.Image(data[key].poster);
      item.imageType = cast.framework.ui.BrowseImageType.MOVIE;
      browseItems.push(item);
    }
  });
  return browseItems;
}

let browseContent = new cast.framework.ui.BrowseContent();
browseContent.title = 'Up Next';
browseContent.items = browseItems;
browseContent.targetAspectRatio = cast.framework.ui.BrowseImageAspectRatio.LANDSCAPE_16_TO_9;

playerDataBinder.addEventListener(
  cast.framework.ui.PlayerDataEventType.MEDIA_CHANGED,
  (e) => {
    if (!e.value) return;

    // Clear default buttons and re-assign
    touchControls.clearDefaultSlotAssignments();
    touchControls.assignButton(
      cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
      cast.framework.ui.ControlsButton.SEEK_BACKWARD_30
    );

    // Media browse
    touchControls.setBrowseContent(browseContent);
  });

context.start({ touchScreenOptimizedApp: true });