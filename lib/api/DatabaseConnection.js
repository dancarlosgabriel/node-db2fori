const SignonConnection = require("./SignonConnection");
const SystemInfo = require("./SystemInfo");
const HostServerConnection = require("./HostServerConnection");
const Conv = require("./Conv");
const {DatabaseServerAttributes, AttributesID} = require("./DatabaseServerAttributes");
const DataBuffer = require("./DataBuffer");

const MEANING = {
  JOB_NAME: 4383
};

module.exports = class DatabaseConnection {
  /**
   * @param {HostServerConnection} databaseServer 
   * @param {SystemInfo} systemInfo 
   * @param {string} jobName 
   * @param {string} user 
   */
  constructor(databaseServer, systemInfo, jobName, user) {
    this.socket = databaseServer;
    this.systemInfo = systemInfo;
    this.jobName = jobName;
    this.user = user;

    this.correlationID = 1;
    this.compress = true;

    if (['localhost', '127.0.0.1'].includes(systemInfo.system)) {
      this.compress = false;
    }
  }

  newCorrelationID() {
    if (this.correlationID == 0x7FFFFFFF) 
      this.correlationID = 0;
    return ++this.correlationID;
  }

  async setServerAttributes(attributes) {
    const connection = this.socket;

    await connection.flush();
    await this.sendSetServerAttributesRequest(attributes);

    await connection.wait();

    console.log('hi');
  }

  /**
   * @param {DatabaseServerAttributes} attributes 
   */
  async sendSetServerAttributesRequest(attributes) {
    const connection = this.socket;
    var length = 40, parms = 0;

    //
    var dataBuffer = new DataBuffer();

    for(const key in attributes) {
      if (attributes[key]) {
        switch (key) {
          case 'defaultClientCCSID':
          case 'drdaPackageSize':
          case 'dateFormatParserOption':
          case 'dateSeparatorParserOption':
          case 'timeFormatParserOption':
          case 'timeSeparatorParserOption':
          case 'decimalSeparatorParserOption':
          case 'namingConventionParserOption':
          case 'ignoreDecimalDataErrorParserOption':
          case 'commitmentControlLevelParserOption':
          case 'asciiCCSIDForTranslationTable':
          case 'ambiguousSelectOption':
          case 'packageAddStatementAllowed':
          case 'dataCompressionParameter':
          case 'locatorPersistence':
          case 'decimalFloatingPointRoundingModeOption':
          case 'decimalFloatingPointErrorReportingOption':
            length += 8;
            parms++;

            dataBuffer.writeInt(8);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeShort(attributes[key]);
            break;

          case 'languageFeatureCode':
            length += 12;
            parms++;

            dataBuffer.writeInt(12);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeShort(37);
            dataBuffer.writePadEBCDIC(attributes[key], 10);
            break;

          case 'clientFunctionalLevel':
            length += 18;
            parms++;

            dataBuffer.writeInt(18);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeShort(37);
            dataBuffer.writePadEBCDIC(attributes[key], 10);
            break;

          case 'NLSSIndentifier':
            var val = attributes.NLSSIndentifier;
            var ll = 8;

            parms++;
            length += 8;

            switch (val) {
              case 1:
              case 2:
                length += 5;
                ll += 5;
                break;
              
              case 3:
                length += 6;
                length += attributes.NLSSIdentifierLanguageTableName.length;
                length += attributes.NLSSIdentifierLanguageTableLibrary.length;

                ll += 6;
                ll += attributes.NLSSIdentifierLanguageTableName.length;
                ll += attributes.NLSSIdentifierLanguageTableLibrary.length;
                break;
            }
            
            dataBuffer.writeInt(ll);
            dataBuffer.writeShort(attributes[key]);
            dataBuffer.writeShort(val);

            if (val == 1 || val == 2)
            {
              dataBuffer.writeShort(37);
              dataBuffer.writePadEBCDIC(attributes.NLSSIdentifierLanguageID, 3);
            }
            else if (val == 3)
            {
              dataBuffer.writeShort(37);

              dataBuffer.writeShort(attributes.NLSSIdentifierLanguageTableName.length);
              dataBuffer.writePadEBCDIC(attributes.NLSSIdentifierLanguageTableName, attributes.NLSSIdentifierLanguageTableName.length);

              dataBuffer.writeShort(attributes.NLSSIdentifierLanguageTableLibrary.length);
              dataBuffer.writePadEBCDIC(attributes.NLSSIdentifierLanguageTableLibrary, attributes.NLSSIdentifierLanguageTableLibrary.length);
            }

            break;
          
          case 'translateIndicator':
          case 'useExtendedFormats':
          case 'trueAutoCommitIndicator':
          case 'hexadecimalConstantParserOption':
          case 'inputLocatorType':
          case 'optimizationGoalIndicator':
          case 'closeOnEOF':
            parms++;
            length += 7;

            dataBuffer.writeInt(7);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeByte(attributes[key]);
            break;

          
          case 'lobFieldThreshold':
          case 'clientSupportInformation':
          case 'queryStorageLimit':
            parms++;
            length += 10;

            dataBuffer.writeInt(10);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeInt(attributes[key]);
            break;

          case 'rdbName':
            parms++;
            length += 8 + attributes.rdbName;

            dataBuffer.writeInt(8 + attributes.rdbName.length);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeShort(37);
            writePadEBCDIC(attributes[key], attributes[key].length, out);
            break;

          case 'maximumDecimalPrecision': //One key to check all below properties
            if (attributes.maximumDecimalPrecision && attributes.maximumDecimalScale && attributes.minimumDivideScale) {
              parms++;
              length += 12;

              dataBuffer.writeInt(12);
              dataBuffer.writeShort(AttributesID.maximumDecimalPrecision);
              dataBuffer.writeShort(attributes.maximumDecimalPrecision);
              dataBuffer.writeShort(attributes.maximumDecimalScale);
              dataBuffer.writeShort(attributes.minimumDivideScale);
            }
            break;
          
          case 'ewlmCorrelator':
            parms++;
            length += 6 + attributes.ewlmCorrelator.length;
            
            dataBuffer.writeInt(6 + attributes[key].length);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeBuffer(attributes[key]);
            break;
          
          case 'defaultSQLLibraryName':
          case 'rleCompression':
          case 'clientAccountingInformation':
          case 'clientApplicationName':
          case 'clientUserIdentifier':
          case 'clientWorkstationName':
          case 'clientProgramIdentifier':
          case 'interfaceType':
          case 'interfaceName':
          case 'interfaceLevel':
            parms++;
            length += 10 + attributes[key].length;

            dataBuffer.writeInt(10 + attributes[key].length);
            dataBuffer.writeShort(AttributesID[key]);
            dataBuffer.writeShort(37); //CCSID?
            dataBuffer.writeShort(attributes[key].length);
            dataBuffer.writePadEBCDIC(attributes[key], attributes[key].length);
            break;
        }
      }
    }

    await this.writeHeader(length, 8064);

    // Write template.
    //await connection.writeInt(0x81000000); // Operational result (ORS) bitmap - return data + server attributes (no RLE compression).
    await connection.writeInt(-2130706432);
    await connection.writeInt(0); // Reserved.
    await connection.writeShort(0); // Return ORS handle - after operation completes.
    await connection.writeShort(0); // Fill ORS handle.
    await connection.writeShort(0); // Based on ORS handle.
    await connection.writeShort(0); // Request parameter block (RPB) handle.
    await connection.writeShort(0); // Parameter marker descriptor handle.
    await connection.writeShort(parms); // Parameter count.

    await connection.writeBuffer(dataBuffer.internalBuffer);
  }

  /**
   * 
   * @param {number} length 
   * @param {number} reqRepID 
   */
  async writeHeader(length, reqRepID) {
    const connection = this.socket;

    await connection.writeInt(length); // Length.
    //    await connection.writeShort(0); // Header ID.
    //    await connection.writeShort(0xE004); // Server ID.
    await connection.writeInt(0x0000E004); // Header ID and Server ID.
    await connection.writeInt(0); // CS instance.
    await connection.writeInt(this.newCorrelationID()); // Correlation ID.
    await connection.writeShort(20); // Template length.
    await connection.writeShort(reqRepID); // ReqRep ID.
  }

  /**
   * 
   * @param {boolean} isSSL 
   * @param {string} system 
   * @param {string} user 
   * @param {string} password 
   * @returns {DatabaseConnection}
   */
  static async getConnection(isSSL, system, user, password) {
    //First we need to connect to the signon server to fetch information about the system.
    const signonConnection = await SignonConnection.getConnection(isSSL, system, user, password);
    const systemInfo = signonConnection.systemInfo;

    //We don't need to keep this connection. Bye bye!
    signonConnection.close();

    const databaseConnection = await DatabaseConnection.createConnection(isSSL, systemInfo, user, password);
    return databaseConnection;
  }

  /**
   * 
   * @param {boolean} isSSL 
   * @param {SystemInfo} systemInfo 
   * @param {string} user 
   * @param {string} password 
   * @returns {DatabaseConnection}
   */
  static async createConnection(isSSL, systemInfo, user, password) {
    const DATABASE_PORT = (isSSL ? 9471 : 8471);
    var databaseConnection = null;

    const databaseServer = new HostServerConnection();
    await databaseServer.connectSocket(systemInfo.system, DATABASE_PORT);

    const jobName = await DatabaseConnection.initialConnect(databaseServer, systemInfo, -8188, user, password);

    databaseConnection = new DatabaseConnection(databaseServer, systemInfo, jobName, user);
    return databaseConnection;
  }

  /**
   * 
   * @param {HostServerConnection} connection 
   * @param {SystemInfo} systemInfo 
   * @param {number} serverID always -8188
   * @param {string} user 
   * @param {string} password 
   * @returns {string} Job name
   */
  static async initialConnect(connection, systemInfo, serverID, user, password) {
    connection.flush();
    var seed = await DatabaseConnection.sendExchangeRandomSeedsRequest(connection, serverID);

    var clientSeed = Buffer.alloc(8);
    clientSeed.writeBigInt64BE(seed);

    await connection.wait();

    var length, returnCode;

    length = connection.readInt();

    if (length < 20) {
      throw new Error(`Exchange random seeds bad length: ${length} ${serverID}`);
    }

    connection.skipBytes(16);

    returnCode = connection.readInt();
    if (returnCode !== 0) {
      throw new Error(`Exchange return code is bad: ${returnCode} ${serverID}`);
    }

    const serverSeed = Buffer.alloc(8);
    connection.readFully(serverSeed);

    const userBytes = HostServerConnection.getUserBytes(user, systemInfo.passwordLevel);
    const passwordBytes = HostServerConnection.getPasswordBytes(password, systemInfo.passwordLevel);
    password = null;

    const encryptedPassword = HostServerConnection.getEncryptedPassword(userBytes, passwordBytes, clientSeed, serverSeed, systemInfo.passwordLevel);

    //Not sure why we do this a second time??
    const userEBCDICBytes = (
      systemInfo.passwordLevel 
      < 2 
      ? userBytes 
      : HostServerConnection.getUserBytes(user, 0)
    );

    connection.flush();
    await DatabaseConnection.sendStartServerRequest(connection, userEBCDICBytes, encryptedPassword, serverID);

    await connection.wait();

    length = connection.readInt();
    if (length < 20) {
      throw new Error(`Start server bad length: ${length} ${serverID}`);
    }

    connection.skipBytes(16);
    returnCode = connection.readInt(16);
    if (returnCode !== 0) {
      const message = getReturnCodeMessage(returnCode);
      if (message) {
        throw new Error(message);
      }
    }

    var jobName = null;
    var remaining = length - 24;

    while (remaining > 10) {
      var ll = connection.readInt();
      var cp = connection.readShort();

      remaining -= 6;

      switch (cp) {
        case MEANING.JOB_NAME:
          connection.skipBytes(4);
          remaining -= 4;
          const jobLength = ll - 10;
          const jobBytes = Buffer.alloc(jobLength);
          connection.readFully(jobBytes);
          jobName = Conv.EBCDICBufferToString(jobBytes, 0, jobBytes.length);
          remaining -= (ll - 6);
          break;

        default:
          connection.skipBytes(ll - 6);
          remaining -= (ll - 6);
          break;
      }
    }

    connection.skipBytes(remaining);

    return jobName;
  }

  static getReturnCodeMessage(returnCode) {
    if ((returnCode & 0xFFFF0000) == 0x00010000)
     return "Error on request data";
    if ((returnCode & 0xFFFF0000) == 0x00040000)
      return "General security error, function not performed";
    if ((returnCode & 0xFFFF0000) == 0x00060000)
      return "Authentication Token error";
    switch (returnCode) {
      case 0x00020001:
        return "Userid error: User Id unknown";
      case 0x00020002:
        return "Userid error: User Id valid, but revoked";
      case 0x00020003:
        return "Userid error: User Id mismatch with authentication token";
      case 0x0003000B:
        return "Password error: Password or Passphrase incorrect";
      case 0x0003000C:
        return "Password error: User profile will be revoked on next invalid password or passphrase";
      case 0x0003000D:
        return "Password error: Password or Passphrase correct, but expired";
      case 0x0003000E:
        return "Password error: Pre-V2R2 encrypted password";
      case 0x00030010:
        return "Password error: Password is *NONE";
    }
    return null;
  }

  /**
   * 
   * @param {HostServerConnection} connection 
   * @param {Buffer} userBytes 
   * @param {Buffer} encryptedPassword 
   * @param {number} serverID 
   */
  static async sendStartServerRequest(connection, userBytes, encryptedPassword, serverID) {
		await connection.writeInt(44 + encryptedPassword.length);
		await connection.writeByte(2); // Client attributes, 2 means return job info.
		await connection.writeByte(0); // Server attribute.
		await connection.writeShort(serverID); // Server ID.
		await connection.writeInt(0); // CS instance.
		await connection.writeInt(0); // Correlation ID.
		await connection.writeShort(2); // Template length.
		await connection.writeShort(0x7002); // ReqRep ID.
		await connection.writeByte(encryptedPassword.length == 8 ? 1 : 3); // Password
																// encryption
																// type.
		await connection.writeByte(1); // Send reply.
		await connection.writeInt(6 + encryptedPassword.length); // Password LL.
		await connection.writeShort(0x1105); // Password CP. 0x1115 is other.
		await connection.writeBuffer(encryptedPassword);
		await connection.writeInt(16); // User ID LL.
		await connection.writeShort(0x1104); // User ID CP.
		await connection.writeBuffer(userBytes);
  }

  /**
   * 
   * @param {HostServerConnection} connection 
   * @param {number} serverID 
   */
  static async sendExchangeRandomSeedsRequest(connection, serverID) {
		await connection.writeInt(28); // Length.
		await connection.writeByte(1); // Client attributes, 1 means capable of SHA-1.
		await connection.writeByte(0); // Server attributes.
		await connection.writeShort(serverID); // Server ID.
		await connection.writeInt(0); // CS instance.
		await connection.writeInt(0); // Correlation ID.
		await connection.writeShort(8); // Template length.
    await connection.writeShort(0x7001); // ReqRep ID.
    
    const longClientSeed = process.hrtime.bigint();
    await connection.writeLong(longClientSeed);
    
		return longClientSeed;
  }
}