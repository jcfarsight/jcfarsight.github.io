// TODO: Add receiver code here
const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

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
              reject();
            } else {
              // Add metadata
              let metadata = new
                 cast.framework.messages.GenericMediaMetadata();
              metadata.title = item.title;
              metadata.subtitle = item.author;

              // Adjusting request to make requested content playable
              request.media.contentUrl = item.stream.dash;
              request.media.contentType = 'application/dash+xml';
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