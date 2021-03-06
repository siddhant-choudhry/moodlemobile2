// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

angular.module('mm.core.fileuploader')

/**
 * Controller to select and upload a file.
 *
 * @module mm.core.fileuploader
 * @ngdoc controller
 * @name mmFileUploaderPickerCtrl
 */
.controller('mmFileUploaderPickerCtrl', function($scope, $mmUtil, $mmFileUploaderHelper, $ionicHistory, $mmApp, $mmFS, $q,
            $mmFileUploaderDelegate, $stateParams) {

    var maxSize = $stateParams.maxsize,
        uploadMethods = {
            album: $mmFileUploaderHelper.uploadImage,
            camera: $mmFileUploaderHelper.uploadImage,
            audio: $mmFileUploaderHelper.uploadAudioOrVideo,
            video: $mmFileUploaderHelper.uploadAudioOrVideo
        };

    $scope.isAndroid = ionic.Platform.isAndroid();
    $scope.handlers = $mmFileUploaderDelegate.getHandlers();

    // Function called when a file is uploaded.
    function successUploading(result) {
        $mmFileUploaderHelper.fileUploaded(result);
        $ionicHistory.goBack();
    }

    // Function called when a file upload fails.
    function errorUploading(err) {
        if (err) {
            $mmUtil.showErrorModal(err);
        }
        return $q.reject();
    }

    // Upload a file given the fileEntry.
    function uploadFileEntry(fileEntry, deleteAfterUpload) {
        return $mmFS.getFileObjectFromFileEntry(fileEntry).then(function(file) {
            return uploadFileObject(file).then(function() {
                if (deleteAfterUpload) {
                    // We have uploaded and deleted a copy of the file. Now delete the original one.
                    $mmFS.removeFileByFileEntry(fileEntry);
                }
            });
        }, function() {
            $mmUtil.showErrorModal('mm.fileuploader.errorreadingfile', true);
            return $q.reject();
        });
    }

    // Upload a file given the file object.
    function uploadFileObject(file) {
        if (maxSize != -1 && file.size > maxSize) {
            return $mmFileUploaderHelper.errorMaxBytes(maxSize, file.name);
        }

        return $mmFileUploaderHelper.confirmUploadFile(file.size).then(function() {
            // We have the data of the file to be uploaded, but not its URL (needed). Create a copy of the file to upload it.
            return $mmFileUploaderHelper.copyAndUploadFile(file).then(successUploading, errorUploading);
        }, errorUploading);
    }

    // Upload a file given the absolute path.
    function uploadFileFromPath(filePath, deleteAfterUpload) {
        var fileEntry,
            file;

        return $mmFS.getExternalFile(filePath).then(function(fe) {
            fileEntry = fe;

            return $mmFS.getFileObjectFromFileEntry(fileEntry);
        }).catch(function() {
            // Error reading file.
            $mmUtil.showErrorModal('mm.fileuploader.errorreadingfile', true);
            return $q.reject();
        }).then(function(f) {
            file = f;

            if (maxSize != -1 && file.size > maxSize) {
                return $mmFileUploaderHelper.errorMaxBytes(maxSize, file.name);
            }

            // Ask confirm if needed.
            return $mmFileUploaderHelper.confirmUploadFile(file.size);
        }).then(function() {
            return $mmFileUploaderHelper.uploadGenericFile(fileEntry.toURL(), file.name, file.type, deleteAfterUpload, false);
        }).then(successUploading)
        .catch(errorUploading);
    }

    // Upload media.
    $scope.upload = function(type, param) {
        if (!$mmApp.isOnline()) {
            $mmUtil.showErrorModal('mm.fileuploader.errormustbeonlinetoupload', true);
        } else {
            if (typeof(uploadMethods[type]) !== 'undefined') {
                uploadMethods[type](param, maxSize).then(successUploading, errorUploading);
            }
        }
    };

    // Upload a file selected with input type="file".
    $scope.uploadFile = function(evt) {
        var input = evt.srcElement;
        var file = input.files[0];
        input.value = ''; // Unset input.
        if (file) {
            uploadFileObject(file);
        }
    };

    // A handler was clicked.
    $scope.handlerClicked = function(e, action) {
        e.preventDefault();
        e.stopPropagation();
        action(maxSize).then(function(data) {
            if (data.uploaded) {
                // The handler already uploaded the file. Return the result.
                successUploading(data.result);
            } else {
                // The handler didn't upload the file, we need to upload it.
                if (data.fileEntry) {
                    // The handler provided us a fileEntry, use it.
                    return uploadFileEntry(data.fileEntry, data.delete);
                } else if (data.path) {
                    // The handler provided a path. First treat it like it's a relative path.
                    return $mmFS.getFile(data.path).then(function(fileEntry) {
                        return uploadFileFromPath(fileEntry.toURL(), data.delete);
                    }, function() {
                        // File not found, it's probably an absolute path.
                        return uploadFileFromPath(data.path, data.delete);
                    });
                }

                // Nothing received, fail.
                $mmUtil.showErrorModal('No file received');
            }
        });
    };

    $scope.$on('$destroy', function(){
        $mmFileUploaderHelper.filePickerClosed();
    });
});
