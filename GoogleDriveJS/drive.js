/******************** GLOBAL VARIABLES ********************/
var SCOPES = ['https://www.googleapis.com/auth/drive', 'profile'];
var CLIENT_ID = 'XXXXXXX';
var FOLDER_NAME = "";
var FOLDER_ID = "root";
var FOLDER_PERMISSION = true;
var FOLDER_LEVEL = 0;
var NO_OF_FILES = 100;
var DRIVE_FILES = [];
var FILE_COUNTER = 0;
var FOLDER_ARRAY = [];
var DELETE_FROM_TRASH = false;

/******************** AUTHENTICATION PROCESS ********************/

function handleClientLoad() {
    //gapi is client library, it used for Load the API client and auth2 library
    gapi.load('client:auth2', initClient);
}

//authorize apps
function initClient() {
    gapi.client.init({
        clientId: CLIENT_ID,
        scope: SCOPES.join(' ')
    }).then(function () {
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    });
}

//check the return authentication of the login is successful, we display the drive box and hide the login box.
function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        $("#drive-box").show();
        $("#login-box").hide();
        showLoading();
        getDriveFiles();
    } else {
        $("#login-box").show();
        $("#drive-box").hide();
    }
}

function handleAuthClick(event) {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
    if (confirm("Are you sure you want to logout?")) {
        gapi.auth2.getAuthInstance().signOut();
    }
}

/******************** END AUTHENTICATION ********************/


/******************** PAGE LOAD ********************/
$(function () {
    $("#button-reload").click(function () {
        showLoading();
        showStatus("Loading Google Drive files...");
        getDriveFiles();
    });

    $("#button-upload").click(function () {
        $("#box-UploadFile").show();
    });

    $("#fUpload").bind("change", function () {
        var uploadObj = $("[id$=fUpload]");
        showLoading();
        showStatus("Uploading file in progress...");
        var file = uploadObj.prop("files")[0];
        var metadata = {
            'title': file.name,
            'description': "File Upload",
            'mimeType': file.type || 'application/octet-stream',
            "parents": [{
                "kind": "drive#file",
                "id": FOLDER_ID
            }]
        };

        //if user upload an empty content, create a temp blob with a space content on it.
        if (file.size <= 0) {
            var emptyContent = " ";
            file = new Blob([emptyContent], { type: file.type || 'application/octet-stream' });
        }

        showProgressPercentage(0);

        try {
            var uploader = new MediaUploader({
                file: file,
                token: 'AIzaSyAXHK3Pt6wFOBeJd56n7nbNsH-vLFhXyy0',
                metadata: metadata,
                onError: function (response) {
                    var errorResponse = JSON.parse(response);
                    showErrorMessage("Error: " + errorResponse.error.message);
                    $("#fUpload").val("");
                    $("#upload-percentage").hide(1000);
                    getDriveFiles();
                },
                onComplete: function (response) {
                    hideStatus();
                    $("#upload-percentage").hide(1000);
                    var errorResponse = JSON.parse(response);
                    if (errorResponse.message != null) {
                        showErrorMessage("Error: " + errorResponse.error.message);
                        $("#fUpload").val("");
                        getDriveFiles();
                    } else {
                        showStatus("Loading Google Drive files...");
                        getDriveFiles();
                    }
                },
                onProgress: function (event) {
                    showProgressPercentage(Math.round(((event.loaded / event.total) * 100), 0));
                },
                params: {
                    convert: false,
                    ocr: false
                }
            });
            uploader.upload();
        } catch (exc) {
            showErrorMessage("Error: " + exc);
            $("#fUpload").val("");
            getDriveFiles();
        }
    });

    $("#button-share").click(function () {
        FOLDER_NAME = "";
        FOLDER_ID = "root";
        FOLDER_LEVEL = 0;
        FOLDER_ARRAY = [];
        $("#span-navigation").html("");
        $(this).toggleClass("flash");
        if ($(this).attr("class").indexOf("flash") >= 0) {
            $("#span-sharemode").html("ON");
        } else {
            $("#span-sharemode").html("OFF");
        }
        showLoading();
        showStatus("Loading Google Drive files...");
        getDriveFiles();
    });

    $("#button-trash").click(function () {
        FOLDER_NAME = "";
        FOLDER_ID = "root";
        FOLDER_LEVEL = 0;
        FOLDER_ARRAY = [];
        $("#span-navigation").html("");
        $(this).toggleClass("flash");
        if ($(this).attr("class").indexOf("flash") >= 0) {
            $("#span-sharemode").html("ON");
        } else {
            $("#span-sharemode").html("OFF");
        }
        showLoading();
        showStatus("Loading Google Drive files...");
        getDriveFiles();
    });

    $("#button-addfolder").click(function () {
        $("#box-AddFolder").show();
        $("#txtFolder").val("");
    });

    $("#btnAddFolder").click(function () {
        if ($("#txtFolder").val() == "") {
            alert("Please enter the folder name");
        } else {
            //$("#box-AddFolder").hide();
            showLoading();
            showStatus("Creating folder in progress...");
            var access_token = 'AIzaSyAXHK3Pt6wFOBeJd56n7nbNsH-vLFhXyy0';
            var request = gapi.client.request({
                'path': '/drive/v2/files/',
                'method': 'POST',
                'headers': {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + access_token,
                },
                'body': {
                    "title": $("#txtFolder").val(),
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [{
                        "kind": "drive#file",
                        "id": FOLDER_ID
                    }]
                }
            });

            request.execute(function (resp) {
                if (!resp.error) {
                    showStatus("Loading Google Drive files...");
                    getDriveFiles();
                } else {
                    hideStatus();
                    hideLoading();
                    showErrorMessage("Error: " + resp.error.message);
                }
            });
        }
    });

    $("#imgCloseInfo").click(function () {
        $("#box-info").css('display', 'none');
    });
    $("#imgCloseAddFolder").click(function () {
        $("#box-AddFolder").css('display', 'none');
    });
    $("#imgCloseAddFile").click(function () {
        $("#box-UploadFile").css('display', 'none');
    });
});

/******************** END PAGE LOAD ********************/

/******************** DRIVER API ********************/
function getDriveFiles() {
    showStatus("Loading Google Drive files...");
    gapi.client.load('drive', 'v2', getFiles);
}

function getFiles() {
    var query = "";
    if (ifShowSharedFiles()) {

        $(".button-opt").hide();
        $(".trash-opt").hide();

        if ($("#drive-breadcrumb a").html() == "Share") {
            if ($("#span-navigation").html() == "") {
                $("#drive-breadcrumb a").html("Share");
            }
            else {
                $(".button-opt").hide();
                $(".trash-opt").hide();
            }
        }
        else {
            $("#drive-breadcrumb a").html("Share");
        }

        DELETE_FROM_TRASH = false;
        query = (FOLDER_ID == "root") ? "trashed=false and sharedWithMe" : "trashed=false and '" + FOLDER_ID + "' in parents";
        
    }
    else if (ifShowTrashFiles()) {
        $(".button-opt").hide();
        $(".share-opt").hide();
        DELETE_FROM_TRASH = true;

        if ($("#drive-breadcrumb a").html() == "Trash") {
            if ($("#span-navigation").html() == "") {
                $("#drive-breadcrumb a").html("Trash");
            }
            else {
                $(".button-opt").hide();
                $(".share-opt").hide();
            }
        }
        else {
            $("#drive-breadcrumb a").html("Trash");
        }

        query = "trashed=true";
        //query = "starred=true";
        //query = "trashed=true and mimeType='application/vnd.google-apps.folder'";
    }
    else {
        if ($("#drive-breadcrumb a").html() == "Trash") {
            
            if ($("#span-navigation").html() == "") {
                $("#drive-breadcrumb a").html("Home");
            }
        }
        else if ($("#drive-breadcrumb a").html() == "Share") {
            if ($("#span-navigation").html() == "") {
                $("#drive-breadcrumb a").html("Home");
            }
        }
        
        DELETE_FROM_TRASH = false;
        query = "trashed=false and '" + FOLDER_ID + "' in parents";
        $(".button-opt").show();
        $(".share-opt").show();
        $(".trash-opt").show();
    }

    var request = gapi.client.drive.files.list({
        'maxResults': NO_OF_FILES,
        'q': query
    });

    request.execute(function (resp) {
        if (!resp.error) {
            showUserInfo();
            DRIVE_FILES = resp.items;
            buildFiles();
        } else {
            showErrorMessage("Error: " + resp.error.message);
        }
    });
}

function showUserInfo() {
    var request = gapi.client.drive.about.get();

    request.execute(function (resp) {
        if (!resp.error) {
            $("#drive-info").show();
            $("#span-name").html(resp.name);
            $("#span-totalQuota").html(formatBytes(resp.quotaBytesTotal));
            $("#span-usedQuota").html(formatBytes(resp.quotaBytesUsed));
        } else {
            showErrorMessage("Error: " + resp.error.message);
        }
    });
}

function buildFiles() {
    var fText = "";
    if (DRIVE_FILES.length > 0) {
        for (var i = 0; i < DRIVE_FILES.length; i++) {
            DRIVE_FILES[i].textContentURL = "";
            DRIVE_FILES[i].level = (parseInt(FOLDER_LEVEL) + 1).toString();
            DRIVE_FILES[i].parentID = (DRIVE_FILES[i].parents.length > 0) ? DRIVE_FILES[i].parents[0].id : "";
            DRIVE_FILES[i].thumbnailLink = DRIVE_FILES[i].thumbnailLink || '';
            DRIVE_FILES[i].fileType = (DRIVE_FILES[i].fileExtension == null) ? "folder" : "file";
            DRIVE_FILES[i].permissionRole = DRIVE_FILES[i].userPermission.role;
            DRIVE_FILES[i].hasPermission = (DRIVE_FILES[i].permissionRole == "owner" || DRIVE_FILES[i].permissionRole == "writer");

            if (DRIVE_FILES[i]['exportLinks'] != null) {
                DRIVE_FILES[i].fileType = "file";
                DRIVE_FILES[i].textContentURL = DRIVE_FILES[i]['exportLinks']['text/plain'];
            }
            var textTitle = (DRIVE_FILES[i].fileType != "file") ? "Browse " + DRIVE_FILES[i].title : DRIVE_FILES[i].title;

            fText += "<div class='" + DRIVE_FILES[i].fileType + "-box'>";
            if (DRIVE_FILES[i].fileType != "file") {
                fText += "<div class='folder-icon' data-file-counter='" + i + "' data-level='" + DRIVE_FILES[i].level + "' data-parent='" + DRIVE_FILES[i].parentID + "' data-size='" + DRIVE_FILES[i].fileSize + "' data-id='" + DRIVE_FILES[i].id + "' title='" + textTitle + "' data-name='" + DRIVE_FILES[i].title + "' data-has-permission='" + DRIVE_FILES[i].hasPermission + "'><div class='image-preview'><img src='../Images/folder.png'/></div></div>";
            }
            else {
                if (DRIVE_FILES[i].thumbnailLink) {
                    fText += "<div class='image-icon' data-file-counter='" + i + "' ><div class='image-preview'><a href='" + DRIVE_FILES[i].thumbnailLink.replace("s220", "s800") + "' data-lightbox='image-" + i + "'><img src='" + DRIVE_FILES[i].thumbnailLink + "'/></a></div></div>";
                } else {
                    if (DRIVE_FILES[i].fileExtension == "txt" ||
                        DRIVE_FILES[i].fileExtension == "xls" ||
                        DRIVE_FILES[i].fileExtension == "xlsx" ||
                        DRIVE_FILES[i].fileExtension == "pdf" ||
                        DRIVE_FILES[i].fileExtension == "ppt" ||
                        DRIVE_FILES[i].fileExtension == "pptx" ||
                        DRIVE_FILES[i].fileExtension == "csv" ||
                        DRIVE_FILES[i].fileExtension == "doc" ||
                        DRIVE_FILES[i].fileExtension == "docx") {
                        fText += "<div class='file-icon' data-file-counter='" + i + "' ><div class='image-preview'><img src='../Images/" + DRIVE_FILES[i].fileExtension + "-icon.png" + "'/></div></div>";
                    }
                    else {
                        fText += "<div class='file-icon' data-file-counter='" + i + "' ><div class='image-preview'><img src='../Images/undefined-icon.png" + "'/></div></div>";
                    }
                }
            }
            fText += "<div class='item-title'>" + DRIVE_FILES[i].title + "</div>";

            //button actions
            fText += "<div class='button-box'>";

            if (DRIVE_FILES[i].fileType != "folder") {
                fText += "<span class='glyphicon glyphicon-download-alt button-download' title='Download' data-id='" + DRIVE_FILES[i].id + "' data-file-counter='" + i + "'></span>";
            }

            fText += "<span class='glyphicon glyphicon-info-sign button-info' title='Info' data-id='" + DRIVE_FILES[i].id + "' data-file-counter='" + i + "'></span>";

            if (DRIVE_FILES[i].hasPermission) {
                if (DRIVE_FILES[i].labels.trashed) {
                    if (DRIVE_FILES[i].permissionRole == "owner") {
                        fText += "<span class='glyphicon glyphicon-remove button-delete' title='Delete' data-id='" + DRIVE_FILES[i].id + "'></span>";
                    } else if (DRIVE_FILES[i].fileType != "folder") {
                        fText += "<span class='glyphicon glyphicon-remove button-delete' title='Delete' data-id='" + DRIVE_FILES[i].id + "'></span>";
                    }
                    fText += "<span class='glyphicon glyphicon-retweet button-restore' title='Restore' data-id='" + DRIVE_FILES[i].id + "'></span>";
                }
                else {
                    if (DRIVE_FILES[i].permissionRole == "owner") {
                        fText += "<span class='glyphicon glyphicon-remove button-delete' title='Delete' data-id='" + DRIVE_FILES[i].id + "'></span>";
                    } else if (DRIVE_FILES[i].fileType != "folder") {
                        fText += "<span class='glyphicon glyphicon-remove button-delete' title='Delete' data-id='" + DRIVE_FILES[i].id + "'></span>";
                    }
                }
            }

            fText += "</div>";
            //closing div    
            fText += "</div>";
        }
    } else {
        fText = 'Empty';
    }
    hideStatus();
    $("#drive-content").html(fText);
    initDriveButtons();
    hideLoading();
}

//Initialize the click button for each individual drive file/folder
//this need to be recalled everytime the Google Drive data is generated
function initDriveButtons() {
    //Initiate the delete button click
    $(".button-delete").unbind("click");
    $(".button-delete").click(function () {
        var c = confirm("Are you sure to delete this?");
        if (c) {
            showLoading();
            showStatus("Deleting file in progress...");

            if (DELETE_FROM_TRASH) {
                showStatus("Deleting file for forever...");
                var request = gapi.client.drive.files.delete({
                    'fileId': $(this).attr("data-id")
                });

                request.execute(function (resp) {
                    hideStatus();
                    if (resp.error) {
                        showErrorMessage("Error: " + resp.error.message);
                    }
                    getDriveFiles();
                });
            }
            else {
                showStatus("Moving file into the trash...");
                var request = gapi.client.drive.files.trash({
                    'fileId': $(this).attr("data-id")
                });

                request.execute(function (resp) {
                    hideStatus();
                    if (resp.error) {
                        showErrorMessage("Error: " + resp.error.message);
                    }
                    getDriveFiles();
                });
            }
        }
    });

    //Initiate the Restore button click
    $(".button-restore").unbind("click");
    $(".button-restore").click(function () {
        showLoading();
        showStatus("Restoring file in progress...");
        var request = gapi.client.drive.files.untrash({
            'fileId': $(this).attr("data-id")
        });

        request.execute(function (resp) {
            hideStatus();
            if (resp.error) {
                showErrorMessage("Error: " + resp.error.message);
            }
            getDriveFiles();
        });
    });

    //Initiate the download button
    $(".button-download").unbind("click");
    $(".button-download").click(function () {
        showLoading();
        showStatus("Downloading file in progress...");
        FILE_COUNTER = $(this).attr("data-file-counter");
        setTimeout(function () {
            //If there is a text version, we get this version instead.
            if (DRIVE_FILES[FILE_COUNTER].webContentLink == null) {
                window.open(DRIVE_FILES[FILE_COUNTER]['exportLinks']['text/plain']);
            } else {
                window.open(DRIVE_FILES[FILE_COUNTER].webContentLink);
            }
            hideLoading();
            hideStatus();
        }, 1000);
    });

    $(".button-info").unbind("click");
    $(".button-info").click(function () {
        FILE_COUNTER = $(this).attr("data-file-counter");

        $("#box-info").show();
        if (DRIVE_FILES[FILE_COUNTER] != null) {
            var createdDate = new Date(DRIVE_FILES[FILE_COUNTER].createdDate);
            var modifiedDate = new Date(DRIVE_FILES[FILE_COUNTER].modifiedDate);
            $("#spanCreatedDate").html(createdDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanModifiedDate").html(modifiedDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanOwner").html((DRIVE_FILES[FILE_COUNTER].owners[0].displayName.length > 0) ? DRIVE_FILES[FILE_COUNTER].owners[0].displayName : "");
            $("#spanTitle").html(DRIVE_FILES[FILE_COUNTER].title);
            $("#spanSize").html((DRIVE_FILES[FILE_COUNTER].fileSize == null) ? "N/A" : formatBytes(DRIVE_FILES[FILE_COUNTER].fileSize));
            $("#spanExtension").html((DRIVE_FILES[FILE_COUNTER].fileExtension == null) ? "N/A" : DRIVE_FILES[FILE_COUNTER].fileExtension);
        }
    });

    //Initiate the click folder browse icon
    $(".folder-icon").unbind("click");
    $(".folder-icon").click(function () {
        if (DELETE_FROM_TRASH) {
            alert('This folder is in your trash, To view this folder, you will need to restore it from your trash.');
        }
        else {
            //Browse folders only when folders are not in trash
            browseFolder($(this), 0);
        }
    });

    $(".file-icon,.image-icon").unbind("click");
    $(".file-icon,.image-icon").click(function () {
        FILE_COUNTER = $(this).attr("data-file-counter");

        $("#spanCreatedDate").html("");
        $("#spanModifiedDate").html("");
        $("#spanOwner").html("");
        $("#spanTitle").html("");
        $("#spanSize").html("");
        $("#spanExtension").html("");

        if (DRIVE_FILES[FILE_COUNTER] != null) {
            var createdDate = new Date(DRIVE_FILES[FILE_COUNTER].createdDate);
            var modifiedDate = new Date(DRIVE_FILES[FILE_COUNTER].modifiedDate);
            $("#spanCreatedDate").html(createdDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanModifiedDate").html(modifiedDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanOwner").html((DRIVE_FILES[FILE_COUNTER].owners[0].displayName.length > 0) ? DRIVE_FILES[FILE_COUNTER].owners[0].displayName : "");
            $("#spanTitle").html(DRIVE_FILES[FILE_COUNTER].title);
            $("#spanSize").html((DRIVE_FILES[FILE_COUNTER].fileSize == null) ? "N/A" : formatBytes(DRIVE_FILES[FILE_COUNTER].fileSize));
            $("#spanExtension").html(DRIVE_FILES[FILE_COUNTER].fileExtension);
        }
    });

    //Initiate the breadcrumb navigation link click
    $("#drive-breadcrumb a").unbind("click");
    $("#drive-breadcrumb a").click(function () {
        browseFolder($(this), 1);
    });
}

//browse folder
function browseFolder(obj, flag) {
    FOLDER_ID = $(obj).attr("data-id");
    FOLDER_NAME = $(obj).attr("data-name");
    FOLDER_LEVEL = parseInt($(obj).attr("data-level"));
    FOLDER_PERMISSION = $(obj).attr("data-has-permission");
    //-------------------------------------------------------------
    //Clear all before Insert
    $("#spanCreatedDate").html("");
    $("#spanModifiedDate").html("");
    $("#spanOwner").html("");
    $("#spanTitle").html("");
    $("#spanSize").html("");
    $("#spanExtension").html("");

    if (flag == 0) {
        FILE_COUNTER = $(obj).attr("data-file-counter");

        if (DRIVE_FILES[FILE_COUNTER] != null) {
            var createdDate = new Date(DRIVE_FILES[FILE_COUNTER].createdDate);
            var modifiedDate = new Date(DRIVE_FILES[FILE_COUNTER].modifiedDate);
            $("#spanCreatedDate").html(createdDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanModifiedDate").html(modifiedDate.toString("dddd, d MMMM yyyy h:mm:ss tt"));
            $("#spanOwner").html((DRIVE_FILES[FILE_COUNTER].owners[0].displayName.length > 0) ? DRIVE_FILES[FILE_COUNTER].owners[0].displayName : "");
            $("#spanTitle").html(DRIVE_FILES[FILE_COUNTER].title);
            $("#spanSize").html((DRIVE_FILES[FILE_COUNTER].fileSize == null) ? "N/A" : formatBytes(DRIVE_FILES[FILE_COUNTER].fileSize));
            $("#spanExtension").html(DRIVE_FILES[FILE_COUNTER].fileExtension);
        }
    }
    else {
        var spanCreatedDate = $(obj).attr("spanCreatedDate");
        var spanModifiedDate = $(obj).attr("spanModifiedDate");
        var spanOwner = $(obj).attr("spanOwner");
        var spanTitle = $(obj).attr("spanTitle");
        var spanSize = $(obj).attr("spanSize");
        var spanExtension = $(obj).attr("spanExtension");

        $("#spanCreatedDate").html(spanCreatedDate);
        $("#spanModifiedDate").html(spanModifiedDate);
        $("#spanOwner").html(spanOwner);
        $("#spanTitle").html(spanTitle);
        $("#spanSize").html(spanSize);
        $("#spanExtension").html(spanExtension);
    }
    //-----------------------------------------------------------------------------------------------------------
    if (typeof FOLDER_NAME === "undefined") {
        FOLDER_NAME = "";
        FOLDER_ID = "root";
        FOLDER_LEVEL = 0;
        FOLDER_PERMISSION = true;
        FOLDER_ARRAY = [];
        $("#box-info").css('display', 'none');

    } else {
        if (FOLDER_LEVEL == FOLDER_ARRAY.length && FOLDER_LEVEL > 0) {
            //do nothing
        }
        else if (FOLDER_LEVEL < FOLDER_ARRAY.length) {
            var tmpArray = cloneObject(FOLDER_ARRAY);
            FOLDER_ARRAY = [];

            for (var i = 0; i < tmpArray.length; i++) {
                FOLDER_ARRAY.push(tmpArray[i]);
                if (tmpArray[i].Level >= FOLDER_LEVEL) { break; }
            }
        }
        else {
            //breadcrumb navigation data insert
            var fd = {
                Name: FOLDER_NAME,
                ID: FOLDER_ID,
                Level: FOLDER_LEVEL,
                Permission: FOLDER_PERMISSION,

                Title: $("#spanTitle").html(),
                CreatedDate: $("#spanCreatedDate").html(),
                ModifiedDate: $("#spanModifiedDate").html(),
                Owner: $("#spanOwner").html(),
                Size: $("#spanSize").html(),
                Extension: $("#spanExtension").html()
            }
            FOLDER_ARRAY.push(fd);
        }
    }

    var sbNav = "";
    for (var i = 0; i < FOLDER_ARRAY.length; i++) {
        sbNav += "<span class='breadcrumb-arrow'></span>";
        sbNav += "<span class='folder-name'><a  spanCreatedDate='" + FOLDER_ARRAY[i].CreatedDate + "' spanModifiedDate='" + FOLDER_ARRAY[i].ModifiedDate + "' spanOwner='" + FOLDER_ARRAY[i].Owner + "' spanSize='" + FOLDER_ARRAY[i].Size + "' spanExtension='" + FOLDER_ARRAY[i].Extension + "' spanTitle='" + FOLDER_ARRAY[i].Title + "' data-id='" + FOLDER_ARRAY[i].ID + "' data-level='" + FOLDER_ARRAY[i].Level + "' data-name='" + FOLDER_ARRAY[i].Name + "' data-has-permission='" + FOLDER_PERMISSION + "'>" + FOLDER_ARRAY[i].Name + "</a></span>";
    }
    $("#span-navigation").html(sbNav.toString());

    showLoading();
    showStatus("Loading Google Drive files...");
    getDriveFiles();
}


//function to clone an object
function cloneObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    var temp = obj.constructor();
    for (var key in obj) {
        temp[key] = cloneObject(obj[key]);
    }
    return temp;
}

//show whether the display mode is share files or not
function ifShowSharedFiles() {
    return ($("#button-share.flash").length > 0) ? true : false;
}

function ifShowTrashFiles() {
    return ($("#button-trash.flash").length > 0) ? true : false;
}

//function to return bytes into different string data format
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " Bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(3) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(3) + " MB";
    else return (bytes / 1073741824).toFixed(3) + " GB";
};

/******************** END DRIVER API ********************/



/******************** NOTIFICATION ********************/
//show loading animation
function showLoading() {
    if ($("#drive-box-loading").length === 0) {
        $("#drive-box").prepend("<div id='drive-box-loading'></div>");
    }
    $("#drive-box-loading").html("<div id='loading-wrapper'><div id='loading'><img src='../Images/loading.gif'></div></div>");
}

//hide loading animation
function hideLoading() {
    $("#drive-box-loading").html("");
}

//show status message
function showStatus(text) {
    $("#status-message").show();
    $("#status-message").html(text);
}

//hide status message
function hideStatus() {
    $("#status-message").hide();
    $("#status-message").html("");
}

//show upload progress
function showProgressPercentage(percentageValue) {
    if ($("#upload-percentage").length == 0) {
        $("#drive-box").prepend("<div id='upload-percentage' class='flash'></div>");
    }
    if (!$("#upload-percentage").is(":visible")) {
        $("#upload-percentage").show(1000);
    }
    $("#upload-percentage").html(percentageValue.toString() + "%");
}

//show error message
function showErrorMessage(errorMessage) {
    $("#error-message").html(errorMessage);
    $("#error-message").show(100);
    setTimeout(function () {
        $("#error-message").hide(100);
    }, 3000);
}

/******************** END NOTIFICATION ********************/
