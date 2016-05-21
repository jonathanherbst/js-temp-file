function openTempFile(fileName)
{
    if(FSAPITempFile.available())
        return FSAPITempFile.open(fileName);
    if(FHAPITempFile.available())
        return FHAPITempFile.open(fileName);
    console.log('openTempFile', "no file api found");
}

function FSAPITempFile(fileEntry)
{
    this.m_fileEntry = fileEntry;
}

function uuid()
{
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

FSAPITempFile.available = function()
{
    return 'requestFileSystem' in window || 'webkitRequestFileSystem' in window;
}

FSAPITempFile.open = function(fileName)
{
    var req = {onsuccess: null};
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    window.requestFileSystem(window.TEMPORARY, 1024*1024*1024, function(fs)
            {
                var dirName = uuid();
                fs.root.getDirectory(dirName, {create: true}, function(dir){
                    dir.getFile(fileName, {create: true, exclusive: true}, function(fileEntry){
                        req.onsuccess(new FSAPITempFile(fileEntry));
                    }, function(e){
                        console.log('fsapi', "get file error: " + e.toString());
                    });
                }, function(e){
                    console.log('fsapi', "get directory error: " + e.toString());
                });
            },
            function(e)
            {
                console.log('fsaip', "filesystem request error: " + e.toString());
            });
    return req;
}

FSAPITempFile.prototype.append = function(data)
{
    var req = {onsuccess: null};
    this.m_fileEntry.createWriter(function(fileWriter) {
        fileWriter.seek(fileWriter.length);
        fileWriter.write(new Blob([data]));
        req.onsuccess();
    }, function(e) {
        console.log('fsapi', "write file error: " + e.toString());
    });
    return req;
}

FSAPITempFile.prototype.url = function()
{
    var req = {onsuccess: null};
    var url = this.m_fileEntry.toURL();
    window.setTimeout(function() {
        req.onsuccess(url);
    });
    return req;
}

function FHAPITempFile(handle)
{
    this.m_handle = handle;
    this.m_file = handle.open("readwrite");
}

FHAPITempFile.available = function()
{
    return 'IDBMutableFile' in window || 'FileHandle' in window;
}

FHAPITempFile.open = function(fileName)
{
    var dbReq = indexedDB.open("testDataBase");
    var req = {onsuccess: null};

    dbReq.onsuccess = function()
    {
        var db = this.result;
        var fileRequest = db.mozCreateFileHandle(fileName, "plain/text");

        fileRequest.onsuccess = function()
        {
            var fileHandle = this.result;
            console.log('handle', fileHandle);
            req.onsuccess(new FHAPITempFile(fileHandle));
        }
    }

    return req;
}

FHAPITempFile.prototype.append = function(data)
{
    return this.m_file.append(data);
}

FHAPITempFile.prototype.url = function()
{
    var req = {onsuccess: null};
    var snapReq = this.m_handle.getFile();

    snapReq.onsuccess = function() {
        var snapshot = this.result;
        req.onsuccess(URL.createObjectURL(snapshot));
    }

    return req;
}

function generate(file, chunkSize, numChunks)
{
    var data = "";
    for(var i = 0; i < chunkSize; ++i)
        data += (i % 10).toString();
    var req = {onsuccess: null, onerror: null};
    _generate(file, req, data, numChunks);
    return req;
}

function _generate(file, req, chunk, numChunks)
{
    if(!numChunks)
    {
        if(req.onsuccess)
            req.onsuccess();
        return;
    }

    var appendReq = file.append(chunk);
    appendReq.onsuccess = function()
    {
        _generate(file, req, chunk, numChunks - 1);
    }
    appendReq.onerror = function()
    {
        if(req.onerror)
            req.onerror();
    }
}
