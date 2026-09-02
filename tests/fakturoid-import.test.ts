import { describe, expect, it } from "vitest";

import { parseCsv } from "@/lib/csv";
import {
  parseImportedDate,
  parseImportedNumber,
  previewClientImport,
  previewInvoiceImport,
} from "@/lib/fakturoid-import";

describe("parseCsv", () => {
  it("pozná středník jako oddělovač", () => {
    const table = parseCsv("a;b;c\n1;2;3\n");

    expect(table.delimiter).toBe(";");
    expect(table.header).toEqual(["a", "b", "c"]);
    expect(table.rows).toEqual([["1", "2", "3"]]);
  });

  it("zvládne uvozovky, oddělovač uvnitř hodnoty i zdvojené uvozovky", () => {
    const table = parseCsv('name,note\n"Alfa, s.r.o.","řekl ""ahoj"""\n');

    expect(table.rows[0]).toEqual(["Alfa, s.r.o.", 'řekl "ahoj"']);
  });

  it("přeskočí prázdné řádky a zvládne Windows konce řádků", () => {
    const table = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");

    expect(table.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });
});

describe("parseImportedNumber", () => {
  it("čte českou i anglickou notaci", () => {
    expect(parseImportedNumber("1 234,56")).toBe(1234.56);
    expect(parseImportedNumber("1,234.56")).toBe(1234.56);
    expect(parseImportedNumber("990")).toBe(990);
    expect(parseImportedNumber("1500 Kc")).toBe(1500);
  });

  it("na neplatné hodnotě vrací null", () => {
    expect(parseImportedNumber("")).toBeNull();
    expect(parseImportedNumber("abc")).toBeNull();
  });
});

describe("parseImportedDate", () => {
  it("čte ISO i český zápis", () => {
    expect(parseImportedDate("2026-01-15")).toBe("2026-01-15");
    expect(parseImportedDate("15. 1. 2026")).toBe("2026-01-15");
    expect(parseImportedDate("3.2.2026")).toBe("2026-02-03");
  });

  it("na nesrozumitelném datu vrací null", () => {
    expect(parseImportedDate("brzy")).toBeNull();
  });
});

describe("previewClientImport", () => {
  const csv = `name,registration_no,vat_no,street,city,zip,country,email,phone
"Alfa s.r.o.",27074358,CZ27074358,"Karlova 12",Praha,11000,CZ,alfa@example.com,+420111222333
"Beta a.s.",,,"Nová 5",Brno,60200,CZ,beta@example.com,
`;

  it("načte kontakty z exportu ve stylu Fakturoidu", () => {
    const preview = previewClientImport(csv);

    expect(preview.records).toHaveLength(2);
    expect(preview.records[0].ico).toBe("27074358");
    expect(preview.records[0].country).toBe("Česká republika");
    expect(preview.records[1].city).toBe("Brno");
    expect(preview.records[1].ico).toBeNull();
  });

  it("řádek bez názvu přeskočí a nahlásí ho", () => {
    const preview = previewClientImport("name,city\n,Praha\nAlfa,Brno\n");

    expect(preview.records).toHaveLength(1);
    expect(preview.skippedRows).toBe(1);
    expect(preview.issues).toHaveLength(1);
  });

  it("upozorní, když chybí sloupec s názvem", () => {
    const preview = previewClientImport("mesto,psc\nPraha,11000\n");

    expect(preview.issues.some((issue) => issue.row === null)).toBe(true);
  });
});

describe("previewInvoiceImport", () => {
  const csv = `number;client_name;client_registration_no;client_street;client_city;client_zip;issued_on;due_on;status;paid_on;currency;total;lines__line__name;lines__line__quantity;lines__line__unit_name;lines__line__unit_price;lines__line__vat_rate
2026001;Alfa s.r.o.;27074358;Karlova 12;Praha;11000;2026-01-15;2026-01-29;paid;2026-01-20;CZK;24200;Konzultace;10;hod;2000;21
;;;;;;;;;;;;Doprava;1;ks;200;21
2026002;Beta a.s.;;Nová 5;Brno;60200;2026-02-03;2026-02-17;open;;CZK;5000;Vývoj;5;hod;1000;0
`;

  it("seskupí položky pod jednu fakturu, i když se číslo neopakuje", () => {
    const preview = previewInvoiceImport(csv);

    expect(preview.records).toHaveLength(2);
    expect(preview.records[0].items).toHaveLength(2);
    expect(preview.records[0].items[1].name).toBe("Doprava");
    expect(preview.records[1].items).toHaveLength(1);
  });

  it("přeloží stav a datum úhrady", () => {
    const preview = previewInvoiceImport(csv);

    expect(preview.records[0].status).toBe("PAID");
    expect(preview.records[0].paidAt).toBe("2026-01-20");
    expect(preview.records[1].status).toBe("ISSUED");
    expect(preview.records[1].paidAt).toBeNull();
  });

  it("z exportu bez položek udělá jednu položku z celkové částky", () => {
    const preview = previewInvoiceImport(
      `cislo;odberatel;ico;datum_vystaveni;splatnost;celkem;stav
FV2026-1;Gama s.r.o.;27074358;3.2.2026;17.2.2026;"12 100,00";zaplaceno
`,
    );

    expect(preview.records).toHaveLength(1);
    expect(preview.records[0].items).toHaveLength(1);
    expect(preview.records[0].items[0].unitPrice).toBe(12100);
    expect(preview.records[0].issueDate).toBe("2026-02-03");
    expect(preview.records[0].status).toBe("PAID");
  });

  it("upozorní na jinou měnu než CZK", () => {
    const preview = previewInvoiceImport(
      "number,client_name,issued_on,currency,total\n1,Alfa,2026-01-15,EUR,100\n",
    );

    expect(
      preview.issues.some((issue) => issue.message.includes("EUR")),
    ).toBe(true);
  });

  it("fakturu bez data vystavení přeskočí", () => {
    const preview = previewInvoiceImport(
      "number,client_name,issued_on,total\n1,Alfa,,100\n",
    );

    expect(preview.records).toHaveLength(0);
    expect(preview.skippedRows).toBe(1);
  });
});
