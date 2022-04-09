-- SQL Query dump, SQL statements done jointly by Taz and Nick
CREATE TABLE ClientAccounts
( 
ClientID int NOT NULL UNIQUE AUTO_INCREMENT,
ClientUserName varchar(25) NOT NULL UNIQUE,
ClientPassword varchar(25) NOT NUll,
FirstName varchar(15) NOT NULL,
LastName varchar(15),
State varchar(30),
City varchar(30),
Birthdate DATE,
Gender varchar(10),
-- make a composite key with the ID and username since we don't want two accounts with the same username
PRIMARY KEY(ClientID, ClientUserName)
);

CREATE TABLE VendorAccounts
(
VendorID int NOT NULL UNIQUE AUTO_INCREMENT,
VendorUserName varchar(25) NOT NULL UNIQUE,
VendorPassword varchar(25) NOT NULL,
CompanyName varchar(100) NOT NULL,
State varchar(2),
City varchar(50),
Address varchar(150),
Profession1 varchar(30) NOT NULL,
Profession2 varchar(30),
Profession3 varchar(30),
Phone varchar(30),
Email varchar(50),
WebsiteURL varchar(2048),
Summary text,
PRIMARY KEY(VendorID, VendorUserName)
);

CREATE TABLE Favorites
(
cID int,
-- Taz must have coded this is sql server, the FK constraints were all wrong for mySQL
FOREIGN KEY(cID) REFERENCES ClientAccounts(ClientID),
favoritedVendor int,
FOREIGN KEY(favoritedVendor) REFERENCES VendorAccounts(VendorID)
); 

CREATE TABLE Project
(
projectID int NOT NULL AUTO_INCREMENT,
PRIMARY KEY(projectID),
userID int,
FOREIGN KEY(userID) REFERENCES clientaccounts(ClientID),
vendorID int,
FOREIGN KEY(vendorID) REFERENCES vendoraccounts(VendorID),
summary varchar(120),
city varchar(20),
address varchar(150),
startDate DATE,
endDate DATE,
pending boolean
);

-- sample data inserts
INSERT INTO clientaccounts  (ClientUserName, ClientPassword, FirstName, LastName, Birthdate, Gender) VALUES
( '1N', 'password1', 'Nick', 'Thomas', '1997-05-12', 'Male'),
( 'TazzA22', 'password2', 'Tazz', 'Akber', '1998-01-01', 'Male'),
( 'MJ24', 'password3', 'Mary', 'Jane', '1982-02-23', 'Female'),
( 'Tester1', 'key1', 'Bob', 'Smith', '1999-01-01', 'NB'),
( 'Tester2', 'key2', 'Kevin', 'Smith', '1999-01-01', 'NB'),
( 'Tester2', 'key1', 'James', 'Smith', '1999-01-01', 'NB');

INSERT INTO vendoraccounts (VendorUserName, VendorPassword, CompanyName, State, City, Profession1, Phone) VALUES 
( 'HDoinks35', 'password1', 'Daves Plumbing Co.', 'CA', 'Los Angeles', 'Plumber', '(231) 562-9902'),
( 'JessicaP29', 'password3', 'Painting Your Way', 'NY', 'Brooklyn', 'Painter', '(718) 492-4431'),
( 'AndyJ20', 'password2', 'Appliances with Andy', 'FL', 'Miami', 'Appliances', '(345) 290-0044'),
( 'RayTheMan', 'password4', 'Ray the Plumber', 'NY', 'Bohemia', 'Plumber', '(631) 581-2500'),
( 'CoolMan', 'password5', 'AC Done Right', 'TX', 'Austin', 'HVAC', '(312) 381-4421'),
( 'CoolerMan', 'password6', 'AC Done Better', 'TX', 'Austin', 'HVAC', '(312) 553-7712'),
( 'CoolestMan', 'password7', 'AC Done Best', 'TX', 'Taxas Town', 'HVAC', '(452) 563-9980'),
( 'Tronk23', 'password8', 'Electron-tastic', 'NY', 'Brooklyn', 'Electrician', '(751) 851-7741'),
( 'Leo34', 'password9', 'Life With Color', 'CA', 'Place in Cali', 'Painter', '(851) 624- 7759'),
( 'TheBrothers', 'password10', 'Mario Bros', 'NY', 'Brooklyn', 'Plumber', '(157) 664-2108');

INSERT INTO vendoraccounts(VendorUserName, VendorPassword, CompanyName, State, City, Profession1, Profession2, Profession3, Phone) VALUES
( 'ShiningServicePeople', 'password11', '5 Star Services', 'CT', 'Place in CT', 'Landscaper', 'Painter', 'HVAC', '(749) 781-6428'),
( 'MasterofNone', 'password12', '1 Stop Repair', 'FL', 'Miami', 'Plumber', 'Electrician', 'Appliances', '(799) 420-5831');

UPDATE vendoraccounts SET Summary = 
'There’s a lot of speculation about what truly is the greatest thing since indoor plumbing. 
But, for our team at Ray The Plumber, the answer is clear: It’s peace of mind. Even more, we believe these two gifts go 
hand-in-hand. You see, when your mind is backed up with concern over your plumbing system’s performance, 
serenity is nowhere to be found—that is, until now. With over four decades of expertise and an extensive line of 
plumbing services, our team will drain away your worries in a flush—it’s like a flash, but even quicker.' 
WHERE CompanyName = 'Ray the Plumber'; 

INSERT INTO Favorites (cID, FavoritedVendor) VALUES (1,2);

INSERT INTO Project (userID, vendorID, startDate, endDate, city) VALUES
(1, 4, '2021-11-22', '2021-11-24', 'NY'),
(1, 1, '2021-10-12', '2021-10-20', 'NY'),
(1, 2, '2021-12-04', '2021-12-06', 'NY');