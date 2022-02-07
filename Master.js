/* Farmingdale Fall 2021 Capstone by Group 1
   All javascript done by Nick Thomas - Reviews feature done by Taz */

//require these modules
var http = require("http");
var fs = require("fs");
var mysql = require("mysql");
var express = require("express");
var path = require("path");
const { json, query } = require("express"); 
var bodyParser = require("body-parser");
const { render } = require("ejs");
var session = require("express-session");
const {v4:uuidv4} = require("uuid");
var cookieParser = require("cookie-parser");
const {Firestore} = require("@google-cloud/firestore");
//require the calendar component made by: https://www.npmjs.com/package/node-calendar-js
const { Calendar } = require("node-calendar-js");
//require the regex range component made by: https://www.npmjs.com/package/to-regex-range
const toRegexRange = require('to-regex-range');
const { rootCertificates } = require("tls");
const PORT = process.env.PORT || 8080;

//application class variable
var app = express();
const {FirestoreStore} = require("@google-cloud/connect-firestore");
const { sync } = require("uid-safe");
const { SSL_OP_EPHEMERAL_RSA } = require("constants");

//define our config for body parser
//With this we can parse data from html inputs from the body tag
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
//app.use(cookieParser); //added cookie parser just in case

//set our view engine for our html templates
//this is what allows us to send dynamic data to an html file
app.set("view engine", "ejs");

//Also we need to set a path to our public folder, this is where static files will be like css and images
app.use(express.static(__dirname + "/public"));

//create our login session
//session is what holds live variables for login and other held values
app.use(session(
    {
        store: new FirestoreStore(
           {
               dataset: new Firestore(),
              kind: 'express-sessions'
          }),
        secret: "itsASecretToEverybody",
        resave: false,
        saveUninitialized: false,
        //this destroys the session when the server response is closed
        unset: 'destroy',
    }
));

//global functions
function ClearData(data)
{
    //I can prob use a property that lets me clear each array but I'll keep it simple for now
    for(var x=0; x<data.length; x++)
    {
        console.log("Deleting this from space: " + data[x]);
        //can use delete keyword for this
        delete data[x];
    }
}

//connect to our mySQL local Database, using a pool allows use to have multiple connections running simutaneaously
/* //Local host
var con = mysql.createPool(
{
    connectionLimit : 100,
    host: "localhost",
    user: "root",
    password: "password",
    database: "world"
});*/

const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME;

var con = mysql.createPool(
{
    connectionLimit: 1000000, //fuckin load this shit
    //to swap from local to deployment, comment out either the host or socketPath respectively
    //host: DB_HOST || "34.85.241.41",
    user: DB_USER || "root",
    password: DB_PASS || "***", //hidden
    datebase: DB_NAME || "***", //hidden
    socketPath: "/cloudsql/sacred-tenure-334200:us-east4:capstonefall21",
});

//test connection
con.getConnection(function(err, connection)
{
    if(err) throw err;

    console.log("Connected to google cloud sql");
    connection.release();
});

//------------------------------------------------------------ GET Statements --------------------------------------------------------
//app.get is for defining the page routes for multiple pages
app.get("/", function(req, res)
{
    //console.log("Present at " + req.url);
    //define the starter page
    res.redirect("/Login");
});

app.get("/UserCreation", function(req, res)
{
    res.render("UserAccountCreation",
    {
        user: req.session.user,
        mySesh: req.sessionID
    });
});

app.get("/Login", function(req, res)
{
    if(req.session.loginErr == null)
        req.session.loginErr = false;
    
    if(req.session.userID != null)
        if(req.session.userType == 1)
            res.redirect("/Home");
        else if(req.session.userType == 2)
                res.redirect("/MyVendorInfo");
                
    //req.session.count +=1;
    res.render("UserLogin",
    {
        user: req.session.user,
        mySesh: req.sessionID,
        logErr: req.session.loginErr
    });
                
});

app.get("/MyVendorInfo", function(req, res)
{
    if(req.session.userType != 2 || req.session.userType == null)
        res.redirect("/Login");
    else
    {
        //get the current info of the active vendor signed in
        con.getConnection(function(err, connection)
        {
            connection.query("SELECT * FROM FullCapstoneWorld.VendorAccounts WHERE VendorID = " + req.session.userID, async function(err, result)
            {
                console.log("Now in my vendor info");
                //we dont need an array here since it should be just 1 record
                req.session.ownVID = await JSON.parse(JSON.stringify(result[0].VendorID));
                req.session.ownCo = await JSON.parse(JSON.stringify(result[0].CompanyName));
                req.session.ownState = await JSON.parse(JSON.stringify(result[0].State));
                req.session.ownCity = await JSON.parse(JSON.stringify(result[0].City));
                req.session.ownPro1 = await JSON.parse(JSON.stringify(result[0].Profession1));
                req.session.ownPhone = await JSON.parse(JSON.stringify(result[0].Phone));

                req.session.save(function()
                {
                    res.redirect("/VendorHome");
                });
            });
        })
    }
});

app.get("/VendorHome", function(req, res)
{
    if(req.session.userType != 2)
        res.redirect("/Login");
    else
        res.render("VendorIntro",
        {
            myVID: req.session.ownVID,
            myName: req.session.ownCo,
            myState: req.session.ownState,
            myCity: req.session.ownCity,
            myPro1: req.session.ownPro1,
            myPhone: req.session.ownPhone,
            user: req.session.user,
            accountType : req.session.userType,
            mySesh: req.sessionID
        });
});

app.get("/Home", function(req, res)
{    
    //this is the page where vendors can be searched and filtered
    if(req.session.userType != 1)
        res.redirect("/Login");
    else
    {
        //try array of 1 dimension for each - tedious but works
        if(req.session.searchCompanies == null)
        {
            console.log("Reassigning null values in HOME::Get");
            req.session.searchCompanies = [];
            req.session.searchStates = [];
            req.session.searchCities = [];
            req.session.searchPro1 = [];
            req.session.searchPhones = [];
            req.session.searchvIDs = [];
        }

        if(req.session.searchQuery == null)
            req.session.searchQuery = false;
        
        res.render("HomeAndSearch", 
        {
            doQuery: req.session.searchQuery, 
            queryResultNames: req.session.searchCompanies,
            queryResultPro1: req.session.searchPro1,
            queryResultStates: req.session.searchStates,
            queryResultCities: req.session.searchCities,
            queryResultPhones: req.session.searchPhones,
            queryResultIDs: req.session.searchvIDs,
            user: req.session.user,
            accountType : req.session.userType,
            mySesh: req.sessionID
        });
    }
});

app.get("/VendorCreation", function(req, res)
{
    res.render("VendorAccountCreation",
    {
        user: req.session.user,
        mySesh: req.sessionID
    });
});

app.get("/Logout", function(req, res)
{
    //destroy resets the session variables
    req.session.destroy(function(err)
    {
        //callback function that checks for an error
        if(err)
        {
            console.log(err);
            res.send(err);
        }
        else
        {
            console.log("Logged Out-")
            res.redirect("/Login");
        }
    });
});

app.get("/EditAccount", function(req, res)
{
    //use this route to determine if the active login is a client or vendor, then redirect to correct page
    if(req.session.userType == 1)
    {
        //grab the current user so the values can be used as defaults in the edit form
        con.getConnection(function(err,connection)
        {
            connection.query("SELECT * FROM FullCapstoneWorld.ClientAccounts WHERE ClientID = " + req.session.userID, async function(err, result)
            {
                //set the values to the curr global
                req.session.currCliUsername = await JSON.parse(JSON.stringify(result[0].ClientUserName));
                req.session.currCliPassword = await JSON.parse(JSON.stringify(result[0].ClientPassword));
                req.session.currCliFirstName = JSON.parse(JSON.stringify(result[0].FirstName));
                req.session.currCliBirth = await JSON.parse(JSON.stringify(result[0].Birthdate));
                req.session.currCliGender = await JSON.parse(JSON.stringify(result[0].Gender));

                req.session.save(function()
                {
                    res.redirect("/EditUser");
                });
            });
        });
    }
    else if(req.session.userType == 2)
    {
        con.getConnection(function(err,connection)
        {
            connection.query("SELECT * FROM FullCapstoneWorld.VendorAccounts WHERE VendorID = " + req.session.userID, async function(err, result)
            {
                console.log("grabbing vendor logged in");
                //set the values to the curr global
                req.session.currVenUsername = await JSON.parse(JSON.stringify(result[0].VendorUserName));
                req.session.currVenPassword = await JSON.parse(JSON.stringify(result[0].VendorPassword));
                req.session.currCompany = await JSON.parse(JSON.stringify(result[0].CompanyName));
                //currState = JSON.parse(JSON.stringify(result[0].State));
                req.session.currCity = await JSON.parse(JSON.stringify(result[0].City));
                req.session.currPhone = await JSON.parse(JSON.stringify(result[0].Phone));

                req.session.save(function()
                {
                    res.redirect("/EditVendor");
                });
                
            });
        });
    }
    else
        res.redirect("/Login");
});

app.get("/EditVendor", function(req, res)
{
    if(req.session.userType != 2)
        res.redirect("/Login");
    else
        res.render("EditVendorAccount",
        {
            setUN: req.session.currVenUsername,
            setPass: req.session.currVenPassword,
            setCo: req.session.currCompany,
            setCity: req.session.currCity,
            setPhone: req.session.currPhone,
            accountType: req.session.userType,
            mySesh: req.sessionID,
            user: req.session.user
        });
});

app.get("/EditUser", function(req,res)
{
    if(req.session.userType != 1)
        res.redirect("/Login");
    else
        res.render("EditUserAccount",
        {
            SetUN: req.session.currCliUsername,
            SetPass: req.session.currCliPassword,
            SetFirst: req.session.currCliFirstName,
            SetBirth: req.session.currCliBirth,
            SetGender: req.session.currCliGender,
            accountType: req.session.userType,
            mySesh: req.sessionID,
            user: req.session.user
        });
});

app.get("/VendorPage/:vID", function(req, res)
{
    req.session.currVenID = req.params.vID;
    console.log("Ven is is now: " + req.session.currVenID);
    con.getConnection(function(err, connection)
    {
        if(err) throw err;
        connection.query("SELECT * FROM FullCapstoneWorld.VendorAccounts WHERE VendorID = '"+req.params.vID+"'", async function(err, result)
        {
            if(err) throw err;

            var temp = JSON.parse(JSON.stringify(result[0].CompanyName));
            console.log(temp);
            req.session.currCompany = temp; //reassign the global variable, acting as a session variable
            //do this for all client globals
            req.session.currPro1 = await JSON.parse(JSON.stringify(result[0].Profession1));
            req.session.currPro2 = await JSON.parse(JSON.stringify(result[0].Profession2));
            req.session.currPro3 = await JSON.parse(JSON.stringify(result[0].Profession3));
            req.session.currState = await JSON.parse(JSON.stringify(result[0].State));
            req.session.currCity = await JSON.parse(JSON.stringify(result[0].City));
            req.session.currPhone = await JSON.parse(JSON.stringify(result[0].Phone));
            req.session.currEmail = await JSON.parse(JSON.stringify(result[0].Email));
            req.session.currSummary = await JSON.parse(JSON.stringify(result[0].Summary));
            //console.log(result[0].Summary);

            req.session.save();
            req.session.save();
            req.session.save();
            req.session.save();
            setTimeout( function()
            { //redirect after the time specified
                req.session.save( function()
                {
                    res.redirect("/VendorPage"); //redirect to the final route which is right below
                });
            }, 1000); //in ms, 1000 is 1 sec,etc
        });
        connection.release();
    });
    
});

//This double redirect actually works kinda well for what we are doing right now, However im sure this is a web design sin for pros
app.get("/VendorPage", function(req, res)
{
    res.render("VendorPage",
    {
        coName:req.session.currCompany,
        venPro1:req.session.currPro1,
        venPro2:req.session.currPro2,
        venPro3:req.session.currPro3,
        venPhone:req.session.currPhone,
        venState:req.session.currState,
        venCity:req.session.currCity,
        Description:req.session.currSummary,
        venEmail:req.session.currEmail,
        venID:req.session.currVenID,
        mySesh: req.sessionID,
        user: req.session.user
    });
});

app.get("/ScheduleMe/:vID", function(req, res)
{
    //await new Promise(resolve => setTimeout(resolve, 5000));
    if(req.session.userType != 1)
        res.redirect("/MyVendorInfo");
    else
    {
        //init check var
        req.session.checkOpen = true;

        var today = new Date(); //used to grab the system date and time on the machine
        if(req.session.todaySQL == null)
        {
            console.log("Null day");
            req.session.todaySQL = today.getMonth()+1;
        }

        if(req.session.currYearSQL == null)
        {
            console.log("null year");
            req.session.currYearSQL = today.getFullYear();
        }
        
        console.log("The month is " + req.session.todaySQL + " and the year is " + req.session.currYearSQL);

        //take this and then redirect to the result, similar to the vendor page logic itself
        con.getConnection(function(err, connection)
        {
            if(err) throw err;
            
            /*
                Do 2 runs of this, one for pending dates, to be highlighted yellow first, 
                than after that- do another that does the crimson highlighting so to show its closed
                update the constraint to allow users to send a request to fight over pending dates
            */
            
            //query for the month and year, default to live time
            //we need to use sql alias' here to refer to the results
            var findDate = "SELECT DAY(startDate) AS 'start', DAY(endDate) AS 'end' FROM FullCapstoneWorld.Project WHERE MONTH(startDate) = "+req.session.todaySQL+
            " AND YEAR(startDate) = "+req.session.currYearSQL;
            var byVendor = " AND vendorID = "+req.params.vID+";";
            req.session.currVenID = req.params.vID;

            //calendar class initialization
        
            //console.log("null cal");
            var cal = new Calendar({
                year: req.session.currYearSQL,
                month: req.session.todaySQL
            });
        
            //update the month and day if needed with the same query variables
            cal.month = req.session.todaySQL - 1; //need to subtract again because of js date library
            cal.year = req.session.currYearSQL;

            //assign the calendar html
            req.session.finalCal = cal.toHTML();

            //first one is for pending jobs, they can still place a reservation
            connection.query(findDate+byVendor, async function(err, result)
            {
                console.log("Finding Pending Dates");
                //loop if needed
                for(var x=0; x<result.length; x++)
                {
                    console.log(result[x]);
                    
                    //let keys = Object.keys(result[0]);
                    //console.log(result[keys[0]]);
                    console.log(result[x].start);
                    console.log(result[x].end);
                    //for each range, make a regex match call to block existing dates in the display
                    //once again, I get lucky by having the day select clause
                    //let calHTML = cal.toHTML();
                    req.session.toReplace1 = new RegExp(">"+toRegexRange(result[x].start,result[x].end)+"<", "g");
                    //finally combine the two - here I replace itself as an update
                    req.session.finalCal = await req.session.finalCal.replace(req.session.toReplace1, "<span style=\"color: coral\"> $&/span><");
                    //console.log("Final Cal is : " + req.session.finalCal);
                }

                //do another nested query for close dates, aka approved non-pending date ranges
                var findDate2 = findDate + " AND pending = 0 ";
                connection.query(findDate2+byVendor, async function(err, results)
                {
                    console.log("in Locked out Dates");
                    if(err) throw err;
                    
                    for(var x=0; x<results.length; x++)
                    {
                        console.log(results[x]);
                        //let keys = Object.keys(result[0]);
                        //console.log(result[keys[0]]);
                        console.log(results[x].start);
                        console.log(results[x].end);
                        //for each range, make a regex match call to block existing dates in the display
                        //once again, I get lucky by having the day select clause
                        //let calHTML = cal.toHTML();
                        req.session.toReplace2 = new RegExp(">"+toRegexRange(results[x].start,results[x].end)+"<", "g");
                        //finally combine the two - here I replace itself as an update
                        req.session.finalCal = await req.session.finalCal.replace(req.session.toReplace2, "<span style=\"color: crimson\"> $&/span><");
                        //console.log("FInal call is finally: " + req.session.finalCal);
                    }
                });
                setTimeout( function()
                { 
                    console.log("Redirecting to page: cal");
                    req.session.save( function()
                    { //this works perfectly
                        res.redirect("/Schedule");
                    });
                }, 1000); 
            });

        });
    }
});

app.get("/Schedule", function(req, res)
{
    console.log("Slot open is " + req.session.checkOpen);
    //now render the page
    res.render("ScheduleVendor", 
    {
        calen: req.session.finalCal,
        venID: req.session.currVenID,
        avail: req.session.checkOpen,
        accountType: req.session.userType,
        mySesh: req.sessionID,
        user: req.session.user
    })
});

//set up another double redirect here with bookmarking a page
app.get("/Bookmarked", function(req, res)
{
    //make sure to clear the search results from last time
    //ClearData(bookmarkResult.companyNames)
    //ClearData(bookmarkResult.Profession1);
    //ClearData(bookmarkResult.Phones);

    //var bookmarkResult = {companyNames: [], States: [], Cities: [], Profession1: [], Phones: [], vIDs: [], vUserNames: []};
    req.session.bookCompanies = [];
    req.session.bookStates = [];
    req.session.bookCities = [];
    req.session.bookPro1 = [];
    req.session.bookPhones = [];
    req.session.bookvIDs = [];
    req.session.bookmarkIDs = [];

    //splice to reset
    console.log("Spliced reset for bookmarks");
    req.session.bookCompanies.splice(0);

    //grab the current list of bookmarked vendors off of the logged in user
    con.getConnection(function(err, connection)
    {
        //do an inner join here so we can grab the vendors in one query- this was actually very cool to utilize
        var join1 = "SELECT FullCapstoneWorld.VendorAccounts.*, FullCapstoneWorld.Favorites.favoritedVendor FROM FullCapstoneWorld.VendorAccounts "
        var join2 = "INNER JOIN FullCapstoneWorld.Favorites ON FullCapstoneWorld.VendorAccounts.VendorID = FullCapstoneWorld.Favorites.favoritedVendor "
        var join3 = "WHERE FullCapstoneWorld.Favorites.cID = "+req.session.userID + ";";
        connection.query(join1+join2+join3, async function(err, result)
        {    
            console.log("In query result bookmarked");
            //grab the ids of the vendors from favorites and store into the bookmark array
            for(var x=0; x<result.length; x++)
            {
                req.session.bookmarkIDs[x] = JSON.parse(JSON.stringify(result[x].favoritedVendor));
                console.log("Grabbed id from favorites");
                    
                //bookmarkResult.vIDs[x] = JSON.parse(JSON.stringify(results[x].VendorID));
                req.session.bookCompanies[x] = await JSON.parse(JSON.stringify(result[x].CompanyName));
                req.session.bookPro1[x] = await JSON.parse(JSON.stringify(result[x].Profession1));
                req.session.bookPhones[x] = await JSON.parse(JSON.stringify(result[x].Phone));
                req.session.bookStates[x] = await JSON.parse(JSON.stringify(result[x].State));
                req.session.bookCities[x] = await JSON.parse(JSON.stringify(result[x].City));
                req.session.bookvIDs[x] = await JSON.parse(JSON.stringify(result[x].VendorID));
                //console.log("Grabbed vendor bookmark");
            }

            req.session.save(function()
            {
                res.redirect("/Bookmarks");
            });
        });
        connection.release();
    })
});

app.get("/Bookmarks", function(req,res)
{
    res.render("Bookmarks",
    {
        queryResultNames: req.session.bookCompanies,
        queryResultPro1: req.session.bookPro1,
        queryResultStates: req.session.bookStates,
        queryResultCities: req.session.bookCities,
        queryResultPhones: req.session.bookPhones,
        queryResultIDs: req.session.bookvIDs,
        accountType: req.session.userType,
        user: req.session.user,
        mySesh: req.sessionID
    });
});

app.get("/getAppointments", function(req, res)
{
    //var heldJobResult = {pID: [], puID:[], usernames:[], pvid:[], summaries:[], cities:[], addresses:[], starts:[], ends:[], pends:[] };
    req.session.heldJobsummaries = [];
    req.session.heldJobcities = [];
    req.session.heldJobaddresses = [];
    req.session.heldJobstarts = [];
    req.session.heldJobends = [];
    req.session.heldJobpuID = [];
    req.session.heldJobpID = [];
    req.session.heldJobusernames = [];

    //grab the held projects and then redirect to the held page
    con.getConnection(function(err, connection)
    {
        if(err) throw err;
        
        console.log("Requests to vendor#: " + req.session.userID);

        connection.query("SELECT * FROM FullCapstoneWorld.Project WHERE(vendorID = "+req.session.userID+") AND pending = 1;", async function(err, result)
        {
            if(err) throw err;

            //clear out this data to refresh the clientside
            //ClearData(heldJobResult.usernames);
            
            for(var x=0; x<result.length; x++)
            {   
                //heldJobResult = {pID: [], puID:[],usernames:[], pvid:[], summaries:[], cities:[], addresses:[], starts:[], ends:[], pends:[] };
                req.session.heldJobsummaries[x] = await  JSON.parse(JSON.stringify(result[x].summary));
                req.session.heldJobcities[x] =await  JSON.parse(JSON.stringify(result[x].city));
                req.session.heldJobaddresses[x] =await  JSON.parse(JSON.stringify(result[x].address));
                req.session.heldJobstarts[x] = await JSON.parse(JSON.stringify(result[x].startDate)).substring(0,10);
                req.session.heldJobends[x] = await JSON.parse(JSON.stringify(result[x].endDate)).substring(0,10);
                req.session.heldJobpuID[x] = await JSON.parse(JSON.stringify(result[x].userID));
                req.session.heldJobpID[x] = await JSON.parse(JSON.stringify(result[x].projectID));
                console.log(JSON.parse(JSON.stringify(result[x].startDate)).substring(0,10));
                console.log(result[x].userID + " userID From the first query in nest");
                //var temp = JSON.parse(JSON.stringify(result[x].userID));
            }

            //get the usernames of the users associated with a for each
            var i=0;
            req.session.heldJobpuID.forEach(function(x)
            {
                connection.query("SELECT ClientUserName FROM FullCapstoneWorld.ClientAccounts WHERE(ClientID = "+x+");",async function(err, results)
                {
                    if(err) throw err;

                    console.log(results[0].ClientUserName+" From pending jobs with temp: " + x + " at " + i);
                    req.session.heldJobusernames[i] = await JSON.parse(JSON.stringify(results[0].ClientUserName));
                    i++;
                    
                    //this works and is quite clever
                    console.log("Lenght is :" + req.session.heldJobpuID.length);
                    if(i == req.session.heldJobpuID.length)
                    {
                        //redirect DURINGIF
                        req.session.save( function()
                        {
                            res.redirect("/HeldAppointments");
                        });
                    }
                });
            });
        });
        connection.release();
    });
});

app.get("/HeldAppointments", function(req, res)
{   
    res.render("PendingJobs",
    {
        heldJobUser: req.session.heldJobusernames,
        heldJobSummary: req.session.heldJobsummaries,
        heldJobstarting: req.session.heldJobstarts,
        heldJobending: req.session.heldJobends,
        accountType: req.session.userType,
        jobNumber: req.session.heldJobpID,
        pending: true,
        mySesh: req.sessionID,
        user: req.session.user
    });
});

app.get("/GetActiveJobs", function(req, res)
{
    //var JobResult = {pID: [], puID:[], usernames:[], pvid:[], summaries:[], cities:[], addresses:[], starts:[], ends:[], pends:[] };
    req.session.JobResultsummaries = [];
    req.session.JobResultcities = [];
    req.session.JobResultaddresses = [];
    req.session.JobResultstarts = [];
    req.session.JobResultends = [];
    req.session.JobResultpuID = [];
    req.session.JobResultpID = [];
    req.session.JobResultusernames = [];

    // same exacl logic as the other page, but the query and array is different
    con.getConnection(function(err, connection)
    {
        if(err) throw err;
        
        console.log("Requests to vendor#: " + req.session.userID)
        connection.query("SELECT * FROM FullCapstoneWorld.Project WHERE(vendorID = "+req.session.userID+") AND pending = 0;", async function(err, result)
        {
            if(err) throw err;
            
            for(var x=0; x<result.length; x++)
            {   
                req.session.JobResultsummaries[x] = await JSON.parse(JSON.stringify(result[x].summary));
                req.session.JobResultcities[x] = await JSON.parse(JSON.stringify(result[x].city));
                req.session.JobResultaddresses[x] = await JSON.parse(JSON.stringify(result[x].address));
                req.session.JobResultstarts[x] = await JSON.parse(JSON.stringify(result[x].startDate)).substring(0,10);
                req.session.JobResultends[x] = await JSON.parse(JSON.stringify(result[x].endDate)).substring(0,10);
                req.session.JobResultpuID[x] = await JSON.parse(JSON.stringify(result[x].userID));
                req.session.JobResultpID[x] = await JSON.parse(JSON.stringify(result[x].projectID));
                console.log(JSON.parse(JSON.stringify(result[x].startDate)).substring(0,10));
                console.log(result[x].userID + " userID From the first query in nest");
                //var temp = JSON.parse(JSON.stringify(result[x].userID));
            }

            //get the usernames of the users associated with a for each
            var i=0;
            req.session.JobResultpuID.forEach(function(x)
            {
                connection.query("SELECT ClientUserName FROM FullCapstoneWorld.ClientAccounts WHERE(ClientID = "+x+");", async function(err, results)
                {
                    if(err) throw err;

                    console.log(results[0].ClientUserName+" From pending jobs with temp: " + x + " at " + i);
                    req.session.JobResultusernames[i] = await JSON.parse(JSON.stringify(results[0].ClientUserName));
                    console.log(req.session.JobResultusernames[i]);
                    i++;

                    console.log("Lenght is :" + req.session.JobResultpuID.length);
                    if(i == req.session.JobResultpuID.length)
                    {
                        //redirect DURINGIF
                        req.session.save(function()
                        {
                            res.redirect("/ActiveAppointments");
                        });
                    }
                    
                });
                
            });
        });
        connection.release();
        //redirect after
        //res.redirect("/ActiveAppointments");
    });
});

app.get("/ActiveAppointments", function(req, res)
{
    res.render("PendingJobs",
    {
        heldJobUser: req.session.JobResultusernames,
        heldJobSummary: req.session.JobResultsummaries,
        heldJobstarting: req.session.JobResultstarts,
        heldJobending: req.session.JobResultends,
        accountType: req.session.userType,
        jobNumber: req.session.JobResultpID,
        pending: false,
        mySesh: req.sessionID,
        user: req.session.user
    });
});

//----------------------------------------------------------- POST STATEMENTS ----------------------------------------------------
//For pages that submit data we append .Pose method for them
app.post("/UserCreation", function(req, res)
{
    //body parser is needed here inorder to get information from the html file
    var username = req.body.username; //these grab the id of the input fields
    var userPassword = req.body.userPassword;
    var firstName = req.body.firstName;
    //var lastName = req.body.lastName;
    var birthday = req.body.birth;
    var gender = req.body.gender;
    //console.log(typeof username);
    console.log("Sending the infomation (Pending): " 
    + username + ", " + userPassword + ", " + firstName + ", " + birthday + ", " + gender);

    //pass to the array so we don't have to requery again
    //clientResultSelection.userNames.push(username);
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var sqlInsert = "INSERT INTO FullCapstoneWorld.ClientAccounts (ClientUserName, ClientPassword, FirstName, Birthdate, Gender) VALUES";
        var values = "('"+username+"', '"+userPassword+"', '"+firstName+"', '"+birthday+"', '"+gender+"')";
        connection.query(sqlInsert + values, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //release the connection
        connection.release();
    });
    
    //clear the buffer
    //username, userPassword, firstName, birthday, gender = null; 
    //THIS WAS CAUSING JUST GENDER TO BE NULL AND THEN SUBMITTED TO THE DB IN EVENT LOOP

    //redirect to another page
    res.redirect("/Login");
});

app.post("/VendorCreation", function(req,res)
{   
    var venUsername = req.body.Vusername; //these grab the id of the input fields
    var venPassword = req.body.VPassword;
    var Company = req.body.companyName;
    var State = req.body.stateChoice;
    var City = req.body.city;
    var pro1 = req.body.profession1;
    var PhoneNO = req.body.phone;
    console.log("Sending the infomation (Pending): " 
    + venUsername + ", " + venPassword + ", " + Company + ", " + State+ ", " + City + ", " + pro1 + ", " + PhoneNO);

    //console.log(Company);
    //pass to the array so we don't have to requery again
    //vendorResultSelection.companyNames.push(Company);
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var sqlInsert = "INSERT INTO FullCapstoneWorld.VendorAccounts (VendorUserName, VendorPassword, CompanyName, State, City, Profession1, Phone)";
        var values = "VALUES ('"+venUsername+"', '"+venPassword+"', '"+Company+"', '"+State+"', '"+City+"', '"+pro1+"', '"+PhoneNO+"')";
        connection.query(sqlInsert + values, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //release the connection
        connection.release();
    });
    
    //clear the buffer

    //redirect to another page
    res.redirect("/Login");
});

app.post("/UserLogin", function(req, res)
{
    console.log("UserLogin Post-");
    var Cusername, Cpassword, SQLuser, SQLpass;

    //var test = req.body.username;
    //console.log(test);
    //grab the input from the login form using the body parser
    Cusername = req.body.username;
    Cpassword = req.body.password;

    console.log("Grabbed from form submit- " + Cusername + " " + Cpassword);

    //check if there is an existing account with that username and password with a where statement
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var whereUser = "SELECT * FROM FullCapstoneWorld.ClientAccounts WHERE ClientUserName = '" + Cusername + "'";
        var wherePass = " AND ClientPassword = '" + Cpassword + "'";
        
        connection.query(whereUser + wherePass, function (err, result, fields)
        {
            //note that the try catch has to be in the same asynchonous function so it exists when the error is thrown
            try
            {
                if(err) throw err;
                console.log("After query" + result[0].ClientUserName + result[0].ClientPassword);
                //grab the query result
                //We actually need a temp here, because by defualt it's passing it by Reference? 
                SQLuser = JSON.parse(JSON.stringify(result[0].ClientUserName));
                SQLpass = JSON.parse(JSON.stringify(result[0].ClientPassword));
                console.log("Grabbed account from database " + SQLuser + "|" + SQLpass);

                //await WaitForValue(SQLuser, temp1);
                //await WaitForValue(SQLpass, temp2);   
                
                //try inside here IT WORKS
                console.log("In the query callback");
                if(Cusername == SQLuser && Cpassword == SQLpass)
                {
                    console.log("If Logged!_ LOGIN SUCESSFUL");
                    req.session.user = SQLuser;
                    req.session.userID = JSON.parse(JSON.stringify(result[0].ClientID));
                    req.session.userType = 1;
                    //res.end("Login Successfull!!");
                    req.session.loginErr = false;
                    res.redirect("/Home");
                    
                }
                else
                {
                    console.log("[" + Cusername + "]["+SQLuser+"]["+SQLpass);
                    console.log("login failed-Check authentication condition");
                    //res.end("login Failed");
                }
            }
            catch(err)
            {
                console.log("Error Caught" + err);
                req.session.loginErr = true;

                req.session.save(function()
                {
                    res.redirect("/Login");
                });
            }
        });
        
        //I AM IN CALLBACK HELL- PLEASE GOD HELP
        //I can just piggy back off of the query callback to make asychonous calls
        //start the session with the logged in user
        //release the connection
        connection.release();
    }); 

});

app.post("/VendorLogin", function(req, res)
{
    console.log("VendorLogin Post-");
    var Vusername, Vpassword, SQLuser, SQLpass;

    Vusername = req.body.Vusername;
    Vpassword = req.body.Vpassword;
    console.log("Grabbed from form submit- " + Vusername + " " + Vpassword);

    //check if there is an existing account with that username and password with a where statement
    //same as user but the query has been changed to reflect Vendors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var whereUser = "SELECT * FROM FullCapstoneWorld.VendorAccounts WHERE VendorUserName = '" + Vusername + "'";
        var wherePass = " AND VendorPassword = '" + Vpassword + "'";
        
        connection.query(whereUser + wherePass, function (err, result, fields)
        {
            try
            {
                if(err) throw err;
                
                SQLuser = JSON.parse(JSON.stringify(result[0].VendorUserName));
                SQLpass = JSON.parse(JSON.stringify(result[0].VendorPassword));
                console.log("Grabbed account from database " + SQLuser + "|" + SQLpass);
                console.log("In the query callback");

                if(Vusername == SQLuser && Vpassword == SQLpass)
                {
                    console.log("If Logged!_ LOGIN SUCESSFUL");
                    req.session.user = SQLuser;
                    req.session.userID = JSON.parse(JSON.stringify(result[0].VendorID));
                    req.session.userType = 2;
                    //res.end("Login Successfull!!");
                    req.session.loginErr = false;
                    req.session.save(function()
                    {
                        res.redirect("/MyVendorInfo");
                    });
                    
                }
                else
                {
                    console.log("[" + Cusername + "]["+SQLuser+"]["+SQLpass);
                    console.log("login failed-Check authentication condition");
                    //res.end("login Failed");
                }
            }
            catch(err)
            {
                req.session.loginErr = true;
                console.log("Error Caught" + err);

                req.session.save(function()
                {
                    res.redirect("/Login");
                });
            }
        });
        connection.release();
    }); 
});

app.post("/EditUser", function(req,res)
{
    //here we want to update the data from a specific logged in account
    //this will be similar to user creation
    var username = req.body.username; 
    var userPassword = req.body.userPassword;
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var state = req.body.stateChoice;
    var city = req.body.city;
    var birthday = req.body.birth || '2000-01-01'; //need this because date must be a specific format - this is the default
    var gender = req.body.gender;
    //console.log(typeof username);
    console.log("Sending the infomation (Pending): " 
    + username + ", " + userPassword + ", " + firstName + ", " + lastName + ", " + birthday + ", " + gender);
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var update1 = "UPDATE FullCapstoneWorld.ClientAccounts SET ClientUserName = '"+
        username+"', ClientPassword = '"+userPassword+"', FirstName = '"+firstName+"', LastName = '"+lastName+"', State = '"+
        state+"', City = '"+city+"', Birthdate = '"+birthday+"', Gender = '"+gender+"'";
        var update2 = " WHERE ClientID = "+req.session.userID;
        connection.query(update1+update2, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //release the connection
        connection.release();
    });
    
    //clear the buffer
    //username, userPassword, firstName, lastName, birthday, gender = null;

    //redirect to another page
    res.redirect("/Home");
});

app.post("/EditVendor", function(req,res)
{
    //Once again similar to the other edit and creation routes
    var venUsername = req.body.Vusername;
    var venPassword = req.body.VPassword;
    var Company = req.body.companyName;
    var State = req.body.stateChoice;
    var City = req.body.city;
    var pro1 = req.body.profession1;
    var pro2 = req.body.profession2;
    var pro3 = req.body.profession3;
    var PhoneNO = req.body.phone;
    var mail = req.body.email

    //get the optional fields from edit
    var street = req.body.address;
    var site = req.body.website;
    var blurb = req.body.summary;
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var update1 = "UPDATE FullCapstoneWorld.VendorAccounts SET VendorUserName = '"+
        venUsername+"', VendorPassword = '"+venPassword+"', CompanyName = '"+Company+"', State = '"+
        State+"', City = '"+City+"', Address = '"+street+"', Phone = '"+PhoneNO+"', WebsiteURL = '"+site+"', Email = '"+mail+"'," +
        " Profession1 = '"+pro1+"', Profession2 = '"+pro2+"', Profession3 = '"+pro3+"', Summary = '"+blurb+"'";
        var update2 = " WHERE VendorID = "+req.session.userID;
        connection.query(update1+update2, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //redirect after the change
        res.redirect("/MyVendorInfo");

        //release the connection
        connection.release();
    });
       
});

app.post("/Home", function(req,res)
{
    //post method for the search bar
    //grab data from the body
    var textSearch = req.body.searchbar;
    var proSelect = req.body.professionChoice;
    var stateSearch = req.body.stateChoice;
    var citySelect = req.body.citySearch;
    console.log("start search: " + textSearch + " " + proSelect + " " + stateSearch + " " + citySelect);

    //make sure to clear the search results from last time
    //ClearData(searchResult.companyNames)
    //ClearData(searchResult.Profession1);
    //ClearData(searchResult.Phones);
    //reinit session results
    //try array of 1 dimension for each - tedious but works
    //ClearData(req.session.searchCompanies);
    //ClearData(req.session.searchStates);
    //ClearData(req.session.searchCities);
    //ClearData(req.session.searchPro1);
    //ClearData(req.session.searchPhones);
    //ClearData(req.session.searchvIDs);
    req.session.searchCompanies.splice(0); //this works for cutting the result down
    console.log(req.session.searchCompanies);

    //set the query into place
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        //req.session.searchResult = {companyNames: [], States: [], Cities: [], Profession1: [], Phones: [], vIDs: [], vUserNames: []};
        // req.session.searchPhones = [];

        //define the sql statement - make use of the % wildcards
        var searchSelect = "SELECT * FROM FullCapstoneWorld.VendorAccounts WHERE UPPER(CompanyName) LIKE UPPER('%"+textSearch+"%')";
        var stateSelect = "AND UPPER(State) LIKE UPPER('%" + stateSearch + "%')";
        var findCity = "AND UPPER(City) LIKE UPPER('%" + citySelect + "%')";
        //add more or conditions to profession for mulitple professions
        var professSelect = " AND ( UPPER(Profession1) LIKE UPPER('%" + proSelect + "%')";
        var professSelect2 = " OR UPPER(Profession2) LIKE UPPER('%" + proSelect + "%')";
        var professSelect3 = " OR UPPER(Profession3) LIKE UPPER('%" + proSelect + "%') )";
        var getProfessionals = professSelect + professSelect2 + professSelect3;

        //now query for the results
        //console.log("starting Query");
        connection.query(searchSelect+stateSelect+findCity+getProfessionals, async function(err, result, fields)
        {
            console.log("inside Query " + result.length);
            if(err) throw err;

            for(var x=0; x<result.length; x++)
            {
                //grab the results into the extra variable for search
                //console.log("grabbing results from home query");
                
                req.session.searchvIDs[x] = await JSON.parse(JSON.stringify(result[x].VendorID)) ;
                req.session.searchCompanies[x] = await JSON.parse(JSON.stringify(result[x].CompanyName));
                req.session.searchPro1[x] = await JSON.parse(JSON.stringify(result[x].Profession1));
                req.session.searchPhones[x] = await JSON.parse(JSON.stringify(result[x].Phone));
                req.session.searchStates[x] = await JSON.parse(JSON.stringify(result[x].State));
                req.session.searchCities[x] = await JSON.parse(JSON.stringify(result[x].City));
                
                console.log(req.session.searchCompanies[x]);
                //console.log("Search Query Grabbed");
            }
            //do the rest of the work in here since its already a callback
            //remember to set doQuery
            req.session.searchQuery = true;

            console.log("Outside Session Assignment");
            //redirect to itself once the data is gathered
            //res.redirect("/Home");

            //TRY TO RE-RENDER - for some reason this handles it better than redirect - not sure why
            res.render("HomeAndSearch", 
            {
                doQuery: req.session.searchQuery, 
                queryResultNames: req.session.searchCompanies,
                queryResultPro1: req.session.searchPro1,
                queryResultStates: req.session.searchStates,
                queryResultCities: req.session.searchCities,
                queryResultPhones: req.session.searchPhones,
                queryResultIDs: req.session.searchvIDs,
                user: req.session.user,
                accountType : req.session.userType,
                mySesh: req.sessionID
            });
            
        });
        connection.release();
    });
});

//can just use action names and then direct to a preexisting page
app.post("/Favorite", function(req, res)
{
    //can't grab it by an indentifieer because ejs is naming the input
    var hidden = req.body.hName0;
    console.log(hidden);
    //res.send(hidden);
    console.log(req.body);
    //I need to set this to grab the first body element
    let keys = Object.keys(req.body);
    console.log(req.body[keys[0]]); //with this we can grab the specified name

    //if the user is not logged in, redirect to the login page
    if(req.session.user == null)
        res.redirect("/Login");
    else
    {
        //in this post we are adding a favorite, so this will be an insert, there are no uniue constraints for now
        con.getConnection(function(err, connection)
        {
            if(err) throw err;

            //insert the pair of logged in 
            connection.query("INSERT INTO FullCapstoneWorld.Favorites (cID, favoritedVendor) VALUES ("+req.session.userID+","+req.body[keys[0]]+")", function(err, result)
            {
                console.log("Values submitted into favorites");
            });

            connection.release();
        })

        //redirect to final bookmark page
        res.redirect("/Home");
    }
});

app.post("/Appoint", function(req, res)
{
    //here I want to check if a date is in the range and if not- put the date into the project record with the user and vendor
    //firstly, redirect if not logged in
    if(req.session.user == null)
        res.redirect("/Login");
    else
    {
        var begin = req.body.starting;
        var endof = req.body.ending;

        //get the values for the days and confirm they are not backwards
        console.log("Start " + begin);
        console.log(begin.substring(8));
        console.log("Between " + endof.substring(8));

        if(begin.substring(8) >  endof.substring(8))
        {
            console.log("Dates are entered backwards");
            res.send("Incorrect date order");
        }
        else
            con.getConnection(function(err, connection)
            {
                if(err) throw err;

                var openTime; //store the 0 or 1 boolean
                //I can use EXISTS to return that boolean
                //from my sql example
                //SELECT EXISTS(SELECT * FROM project WHERE
                //( (startDate BETWEEN '2021-12-02' AND '2021-12-03') OR endDate BETWEEN startDate AND '2021-12-05') ) AS 'isOpen';
                var checkAvail = "SELECT EXISTS(SELECT * FROM FullCapstoneWorld.Project WHERE";
                var dateRange = "( (startDate BETWEEN '"+begin+"' AND '"+endof+"') OR endDate BETWEEN '"+begin+"' AND '"+endof+"') AND vendorID = "+req.session.currVenID+") AS 'isOpen';";
                connection.query(checkAvail+dateRange, function(err, result)
                {
                    if(err) throw err;

                    console.log("Existing is :" + result[0].isOpen);
                    //console.log(result[0]);
                    openTime = result[0].isOpen;

                    if(openTime == 0) //as in there are no dates in that range, and we are good to go
                    {
                        //grab remaining body elements
                        var city = req.body.city;
                        var address = req.body.address;
                        var fullSummary = req.body.JobSummary;
                        //insert into db
                        console.log("inserting into project:db:project");
                        var insert = "INSERT INTO FullCapstoneWorld.Project (userID, vendorID, startDate, endDate, city, address, summary, pending) VALUES";
                        var values = "("+req.session.userID+", " +req.session.currVenID+ ", '"+begin+"', '"+endof+"', '"+city+"', '"+address+
                        "', '"+fullSummary+"', 1);";
                        connection.query(insert+values, function(err, result)
                        {
                            console.log("values inserted");
                            req.session.checkOpen = true;
                            res.redirect("/Home");
                        });
                    }
                    else
                    {
                        console.log("Slot is closed");
                        req.session.checkOpen = false;

                        req.session.save(function()
                        {
                            res.redirect("/Schedule");
                        });
                    }

                    connection.release();
                });
            })
    }
});

app.post("/MonthNav", function(req, res)
{
    //change the month and year in calendar and then redirect back to the other page
    async function waitForMonth()
    {
        var newMonth = req.body.newTime;
        let theMonth = newMonth.substring(5);
        let theYEar = newMonth.substring(0,4);
        
        console.log("NEW month entered: " + newMonth);
        //console.log(theMonth);
        req.session.todaySQL = await theMonth;
        req.session.currYearSQL = await theYEar;
        console.log(req.session.todaySQL);
        
        //return the last value after the others are reassigned
        return req.body.hidVenID;
    }

    waitForMonth().then( function(value) 
        {
            //redirect to the calendar page
            console.log("After the async functon");
            //save is a method that ensures the session is updated in storage, and can use callbacks, usfull in redirects
            req.session.save( function()
            {
                res.redirect("/ScheduleMe/"+value); //doesn't fully grab without save callback
            });
        }
    );
    
});

app.post("/Approve", function(req, res)
{
    /*
        same logic as the other control except I'm updating the record to be 0 for pending,
        which is false for the pending status, and interpreted as "locked in"
        if a job request is declined then it is simply deleted
    */

    var jobID = req.body.WhichJob;
    
    //clear data from results
    //ClearData(JobResult.usernames);

    //update record to be locked in
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        connection.query("UPDATE FullCapstoneWorld.Project SET pending = 0 WHERE projectID = " + jobID + ";", function(err, result)
        {
            if(err) throw err;

            console.log("Updated pending request to accepted");
            res.redirect("/Home");
        });
    });

});

app.post("/Decline", function(req, res)
{
    var jobID = req.body.WhichJob;
    console.log("Deleting jbo request ID#"+jobID);

    //clear data from results
    //ClearData(heldJobResult.username);

    //delete record from the table and then redirect to the first part of held jobs
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        connection.query("DELETE FROM FullCapstoneWorld.Project WHERE projectID = " + jobID + ";", function(err, result)
        {
            if(err) throw err;

            console.log("Successfully deleted Item from database");
            res.redirect("/Home");
        });
    });
});

//Listener always goes on the bottom
app.listen(PORT);
console.log("Currently listening to port " + PORT);

//-------------------------------------------- Commented out code and other trash ------------------------------------------------------------
//These must be gathered out side the HTMl Render as render is sync if done in the same get statement
//runs again after redirect
//SELECTION Statements From Database - testing 

//keep these are the end - i don't want to deal with callbacks if I don't have to and they're only for dev checks

/*
app.get("/UserList", function(req, res)
{
    res.render("UserAccountList", 
    {
        userData: clientResultSelection.userNames, 
        user : req.session.user,
    });
});

app.get("/VendorList", function(req, res)
{
    //console.log(vendorResultSelection.companyNames[0]);
    res.render("VendorAccountList_Dashboard", 
    {
        vendorData: vendorResultSelection.companyNames,
        user : req.session.user
    });
});

//test the calendar object by passing the html as a ejs route parameter

app.get("/CalTest", function(req,res)
{
    res.render("CalendarByMonth", 
    {
        theCal: cal.toHTML(),
        newCal: finalCal
    });
});

/*
           // console.log("starting Async Function");
            //async function waitForResult()
            //{
             //   console.log("inside Asynchonous function");
                async function giveMeABreak()
                {
                    console.log("1");
                    await aBreak(1000);
                    console.log("2");
                }

                function aBreak(ms)
                {
                    return new Promise((resolve) =>
                    {
                        setTimeout(ms);
                    });
                }
                giveMeABreak();
                */
//   }

//  waitForResult();

/*
con.getConnection(function(err, connection)
{
    if(err) throw err;

    //in the future this might want to be a more lax query, consider doing chunks and requering on the page
    var sqlSelect = "SELECT * FROM FullCapstoneWorld.ClientAccounts";
    connection.query(sqlSelect,function(err, result, fields)
    {
        if(err) throw err;

        //test the select statement as a whole
        console.log(result);
        //console.log(typeof result.FirstName);

        for(var x=0; x<result.length; x++) 
        {
            //use parse-stringify to remove "" when outputting the data
            var temp = JSON.parse(JSON.stringify(result[x].ClientUserName));
            clientResultSelection.userNames[x] = temp;
            console.log(temp);
            console.log(typeof temp);

            temp = JSON.stringify(result[x].FirstName);
            clientResultSelection.firstNames[x] = temp;

            temp = JSON.stringify(result[x].LastName);
            clientResultSelection.lastNames[x] = temp;

            temp = JSON.stringify(result[x].Birthdate);
            clientResultSelection.ages[x] = temp;

            temp = JSON.stringify(result[x].Gender);
            clientResultSelection.genders[x] = temp;
            
            //console.log("Grabbed element: " + clientResultList[x]);
        }
        console.log("grabbed all data from db::From Function get--UserList");
    });

    //grab the vendors here as well since we have the pooling we are fine here
    connection.query("SELECT * FROM FullCapstoneWorld.VendorAccounts", function(err, result, fields)
    {
        if(err) throw err;

        console.log("Grabbing data from vendors for the handy-dashboard");
        for(var x=0; x<result.length; x++)
        {
            vendorResultSelection.companyNames[x] = JSON.parse(JSON.stringify(result[x].CompanyName));
            vendorResultSelection.States[x] = JSON.parse(JSON.stringify(result[x].State));
            vendorResultSelection.Cities[x] = JSON.parse(JSON.stringify(result[x].City));
            vendorResultSelection.Professions[x] = JSON.parse(JSON.stringify(result[x].Profession1));
            vendorResultSelection.Phones[x] = JSON.parse(JSON.stringify(result[x].Phone));
        }
    });
    
    console.log("Vendors gathered");
    //release the connection back into the pool
    connection.release();
});
*/

/*
SESSION VARIABLES:
User,  is the session login of the username
userID, is the session login of the sql id assigned to each account
userType, determines if it is a vendor or client logged in (1 for user, 2 for vendor)
*/
//global.req = req;

//in order to reformat the calender for my(nick) use, I need to use regular expressions to replace certain days
//let's try this here, thankfully js can use regex to replace patterns in large strings
//calHTML.replace(/>[0-9]{1,2}</g, "><span style=\"color: crimson\"> $& </span><"); //for all values
//let finalCal = calHTML.replace(/></g, "><span style=\"color: crimson\"> $& </span><");
//to use variables in regex statements we can use js regExp object for more advanced statements
//let calHTML = cal.toHTML();
//var toReplace = new RegExp(toRegexRange(13,15)+"<", "g");
//finally combine the two
//let finalCal = calHTML.replace(toReplace, "<span style=\"color: crimson\"> $&/span><"); //<-- THIS
//THIS IS PERFECTION
//with this in place we can grab the default as the server time and date, and allow the user to nav with html inputs
//for every range we find in the sql, run one of these, each record should have a start and an end date


/*
    the gist of the ranges when using these regex statements will be using >(:firstdigit:[range])|>( :...)
    luckily I don't have to code the whole logic myself and can skip that step by using another npm for it
    using this I can finally alter the range and reformat to display what ranges are not allowed
*/

//global variables - use these to gather input alonsgide the session login 
//NOTE: These globals are active for all users on the deployment
//var clientResultSelection = {userNames: [], firstNames: [], lastNames: [], ages: [], genders: []};
//var vendorResultSelection = {companyNames: [], States: [], Cities: [], Professions: [], Phones: []};
//var searchResult = {companyNames: [], States: [], Cities: [], Profession1: [], Phones: [], vIDs: [], vUserNames: []};
//var bookmarkResult = {companyNames: [], States: [], Cities: [], Profession1: [], Phones: [], vIDs: [], vUserNames: []};
//var heldJobResult = {pID: [], puID:[], usernames:[], pvid:[], summaries:[], cities:[], addresses:[], starts:[], ends:[], pends:[] };
//var JobResult = {pID: [], puID:[], usernames:[], pvid:[], summaries:[], cities:[], addresses:[], starts:[], ends:[], pends:[] };
// [] is useable as an unbounded array size, and this { defines properties }
//var searchQuery = false;
//var checkOpen = true;

//These are for the user viewing a specific vendor, the results are queried and displayed clientside after a redirect
//var currVenID;
//var currVenUsername; 
//var currVenPassword;
//var currCompany;
//var currState;
//var currCity;
//var currPro1;
//var currPhone;
//var currSummary;
//var currEmail;

//var currCliUsername; 
//var currCliPassword;
//var currCliFirstName;
//var currCliLastName;
//var currCliState;
//var currCliCity;
//var currCliBirth;
//var currCliGender;

//console.log(currYearSQL);

/*
//try new instance of the class
var cal2 = new Calendar(
{
    month: theMonth,
    year: 2021
});
//cal.setMonths = theMonth;
//might need a callback
*/

//remember to change the global query variables too
