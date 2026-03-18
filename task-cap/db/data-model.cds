namespace com.example;
using { cuid, managed } from '@sap/cds/common';

entity Tasks : cuid, managed {
    title       : String(255) not null;
    description : String(1000);
    completed   : Boolean default false not null;
}
