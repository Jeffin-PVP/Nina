const LogBuilder = require("./LogBuilder");

module.exports = {

    create(data) {

        try {

            return LogBuilder.create(data);

        } catch (error) {

            console.error(

                "[Logs] Erro ao criar log:",

                error

            );

            return null;

        }

    }

};