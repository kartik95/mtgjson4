'use strict';

var downloader = require('./downloader');

var cheerio = require('cheerio');
var hitme = require('hitme');

var url_prefix = 'http://gatherer.wizards.com';

var downloadFiles = function(multiverseid, callback) {
    var oracleUrl = url_prefix + '/Pages/Card/Details.aspx?printed=false&multiverseid=' + multiverseid;
    var printedUrl = url_prefix + '/Pages/Card/Details.aspx?printed=true&multiverseid=' + multiverseid;

    var ret = {
        languages: [],
        printings: []
    };

    var caller = hitme(callback);
    caller.data = ret;

    caller(function(cb) {
	downloader.get(oracleUrl).then(function(data) {
            ret.oracle = data.getBody();
	    cb();
        }).fail(function(data) { callback(data); });
    });
    caller(function(cb) {
        downloader.get(printedUrl).then(function(data) {
            ret.printed = data.getBody();
            cb();
        }).fail(function(data) { callback(data); });
    });

    // Download all the printings URLS
    var grabPrintings = function(page, callback) {
        var maxPage = 1;
        if (grabPrintings.maxPage)
            maxPage = grabPrintings.maxPage;
	var url = url_prefix + '/Pages/Card/Printings.aspx?page=' + page + '&multiverseid=' + multiverseid;

	downloader.get(url).then(function(data) {
            ret.printings.push(data.getBody());

	    var $ = cheerio.load(data.getBody());
	    var pages = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_PrintingsList_pagingControlsContainer');
	    if (pages.length > 0) {
		$('a', pages).each(function(idx, obj) {
		    var n = parseInt($(obj).text().trim());
		    if (n > maxPage)
			maxPage = n;
		});
	    }

            page++;
            grabPrintings.maxPage = maxPage;
            if (page < maxPage)
                setImmediate(grabPrintings, page, callback);
            else
                callback();
	}).fail(function(data) { callback(data); });
    };

    // Download all languages URLS
    var grabLanguages = function(page, callback) {
        var maxPage = 1;
        if (grabLanguages.maxPage)
            maxPage = grabLanguages.maxPage;
        var url = url_prefix + '/Pages/Card/Languages.aspx?page=' + page + '&multiverseid=' + multiverseid;

	downloader.get(url).then(function(data) {
            ret.languages.push(data.getBody());

	    var $ = cheerio.load(data.getBody());
	    var pages = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_languageList_pagingControls');
	    if (pages.length > 0) {
		$('a', pages).each(function(idx, obj) {
		    var n = parseInt($(obj).text().trim());
		    if (n > maxPage)
			maxPage = n;
		});
	    }

            page++;
            grabLanguages.maxPage = maxPage;
            if (page < maxPage)
                setImmediate(grabLanguages, page, callback);
            else
                callback();
	}).fail(function(data) { callback(data); });
    };

    caller(function(cb) {
        grabPrintings(0, cb);
    });
    caller(function(cb) {
        grabLanguages(0, cb);
    });
};

module.exports = function(multiverseid, callback) {
    console.log(multiverseid);
    downloadFiles(multiverseid, function(err, data) {
        console.log(Object.keys(data));
        callback(err, data);
    });
};

module.exports.downloadFiles = downloadFiles;

module.exports.downloadSetCardList = function(setName, callback) {
    var set = setName.replace(/ /g, '+');
    var maxpages = 1;

    var ret = [];

    var downloadPage = function(pagenum) {
	var url = url_prefix + '/Pages/Search/Default.aspx?output=checklist&set=%5b%22' + set + '%22%5d&page=' + pagenum;

	console.log(url);

	downloader.get(url).then(function(data) {
	    var $ = cheerio.load(data.getBody());

	    var pageList = $('#ctl00_ctl00_ctl00_MainContent_SubContent_topPagingControlsContainer');
	    $('a', pageList).each(function(idx, obj) {
		var num = parseInt($(obj).text());
		if (num > maxpages)
		    maxpages = num;
	    });

	    // Read the cards
	    var checklist = $('#ctl00_ctl00_ctl00_MainContent_SubContent_SubContent_searchResultsContainer tr.cardItem');
	    checklist.each(function(idx, cardItem) {
		var obj = $('.nameLink', cardItem);
		var card = {};
		card.number = $('.number', cardItem).html();
		card.name = $(obj).html();
		card.multiverseid = $(obj).attr('href').match(/multiverseid=([^&]*)/)[1];
		card.artist = $('.artist', cardItem).html();
		card.color = $('.color', cardItem).html();
		card.rarity = $('.rarity', cardItem).html();
		card.set = $('.set', cardItem).html();
		ret.push(card);
	    });

	    // Next page?
	    pagenum++;
	    if (pagenum < maxpages) {
		setImmediate(downloadPage, pagenum);
	    }
	    else {
		callback(null, ret);
	    }
	}).fail(function(data) { callback(data); });
    };

    downloadPage(0);
};
